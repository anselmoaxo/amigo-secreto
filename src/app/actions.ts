"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { consumeLoginToken, getUser, logout, requestLogin, requireUser } from "@/lib/auth";
import * as q from "@/lib/queries";
import { drawEmail, sendEmail } from "@/lib/email";
import { safeNext } from "@/lib/format";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = text(f, k).replace(",", ".");
  return v === "" ? null : Number(v);
};

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}erro=${encodeURIComponent(message)}`);
}

/** Roda a operação; erros esperados voltam para a página como mensagem. */
async function attempt<T>(path: string, fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof q.AppError) fail(path, e.message);
    console.error(e);
    fail(path, fallback);
  }
}

// Login ----------------------------------------------------------------
export async function sendMagicLink(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const next = safeNext(text(form, "next"));
  const back = `/login?next=${encodeURIComponent(next)}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) fail(back, "E-mail inválido.");
  await attempt(back, () => requestLogin(email, next), "Não deu para enviar o link. Tente de novo.");
  redirect(`/login?enviado=${encodeURIComponent(email)}`);
}

export async function verifyLogin(form: FormData) {
  const next = safeNext(text(form, "next"));
  const ok = await consumeLoginToken(text(form, "token"));
  if (!ok) fail("/login", "Link expirado ou já usado. Peça um novo.");
  redirect(next);
}

export async function signOut() {
  await logout();
  redirect("/");
}

// Grupos ---------------------------------------------------------------
export async function createGroup(form: FormData) {
  const user = await requireUser("/grupos/novo");
  const back = "/grupos/novo";
  const name = text(form, "name");
  const displayName = text(form, "display_name");
  const min = num(form, "min_value");
  const max = num(form, "max_value");
  if (!name || !displayName) fail(back, "Preencha o nome do grupo e o seu nome.");
  if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0))) fail(back, "Valor inválido.");
  if (min !== null && max !== null && min > max) fail(back, "O valor mínimo é maior que o máximo.");
  const eventDate = text(form, "event_date");

  const id = await attempt(back, () => q.createGroup(user.id, {
    name: name.slice(0, 80),
    displayName: displayName.slice(0, 60),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
    location: text(form, "location").slice(0, 120) || null,
    min, max,
  }), "Não foi possível criar o grupo.");
  redirect(`/grupos/${id}`);
}

export async function joinGroup(form: FormData) {
  const code = text(form, "code");
  const back = `/g/${encodeURIComponent(code)}`;
  const user = await requireUser(back);
  const displayName = text(form, "display_name").slice(0, 60);
  if (!displayName) fail(back, "Diga seu nome.");
  const id = await attempt(back, () => q.joinGroup(code, user.id, displayName), "Não foi possível entrar.");
  redirect(`/grupos/${id}`);
}

// Lista de desejos -----------------------------------------------------
export async function addWish(form: FormData) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const user = await requireUser(path);
  const description = text(form, "description").slice(0, 200);
  let link: string | null = text(form, "link") || null;
  if (!description) fail(path, "Escreva o que você quer ganhar.");
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  await attempt(path, () => q.addWish(groupId, user.id, description, link), "Não foi possível salvar o desejo.");
  revalidatePath(path);
}

export async function deleteWish(form: FormData) {
  const groupId = text(form, "group_id");
  const user = await requireUser(`/grupos/${groupId}`);
  await q.deleteWish(text(form, "id"), user.id);
  revalidatePath(`/grupos/${groupId}`);
}

// Painel do organizador ------------------------------------------------
async function ownerAction(form: FormData, fn: (groupId: string, userId: string) => Promise<unknown>, fallback: string) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const user = await requireUser(path);
  await attempt(path, () => fn(groupId, user.id), fallback);
  revalidatePath(path);
}

export async function removeParticipant(form: FormData) {
  await ownerAction(form, (g, u) => q.removeParticipant(g, u, text(form, "participant_id")), "Não foi possível remover.");
}

export async function addExclusion(form: FormData) {
  await ownerAction(form, (g, u) => q.addExclusion(g, u, text(form, "a"), text(form, "b")), "Não foi possível salvar a regra.");
}

export async function deleteExclusion(form: FormData) {
  await ownerAction(form, (g, u) => q.deleteExclusion(g, u, text(form, "id")), "Não foi possível remover a regra.");
}

export async function runDraw(form: FormData) {
  await ownerAction(form, async (groupId, userId) => {
    const { groupName, people } = await q.runDraw(groupId, userId);
    await Promise.all(people.map((p) =>
      sendEmail(p.email, `🎁 Sorteio feito: ${groupName}`, drawEmail(p.display_name, groupName, groupId)),
    ));
  }, "Erro ao fazer o sorteio.");
}

export async function reopenGroup(form: FormData) {
  await ownerAction(form, (g, u) => q.reopenGroup(g, u), "Não foi possível reabrir.");
}

export async function markSeen(groupId: string) {
  const user = await getUser();
  if (user) await q.markSeen(groupId, user.id);
}
