"use server";

import { revalidatePath } from "next/cache";
import * as q from "@/lib/queries";
import { sendPersonalInvite } from "@/lib/notify";
import { cleanPerson, isEmail, normalizePhone, validatePerson } from "@/lib/validation";
import { bool, done, failed, guard, text, type ActionState } from "./state";

async function me(token: string) {
  const res = await q.getByAccessToken(token);
  if (!res) throw new q.AppError("Este link não funciona mais. Peça um novo ao organizador.");
  return res;
}

const refresh = (token: string) => revalidatePath(`/p/${token}`);

export type JoinState = ActionState & { token?: string };

/** Entrar pelo convite geral do grupo. */
export async function joinAction(_: JoinState, form: FormData): Promise<JoinState> {
  const person = { name: text(form, "name", 100), email: text(form, "email", 250), phone: text(form, "phone", 40), team: "" };
  const errors = validatePerson(person);
  if (Object.keys(errors).length) return failed("Confira os campos destacados.", errors);
  if (!bool(form, "consent")) return failed("Para entrar, confirme que leu como usamos seus dados.", { consent: "Marque para continuar." });
  const result = await guard(async () => {
    const token = await q.joinByInvite(text(form, "code", 40), cleanPerson(person));
    if (person.email) {
      // Manda o link para a pessoa guardar; se o e-mail falhar, ela continua com o link na tela.
      const res = await q.getByAccessToken(token);
      if (res) await sendPersonalInvite(res.me, res.group, token).catch((e) => console.error(e));
    }
    return { ...done("Você entrou no grupo."), token } as JoinState;
  });
  return result;
}

export async function respondAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, "t", 80);
  const answer = text(form, "answer") === "declined" ? "declined" : "confirmed";
  return guard(async () => {
    const { me: p, group } = await me(token);
    await q.respond(p, group, answer);
    refresh(token);
    return done(answer === "confirmed" ? "Presença confirmada." : "Tudo bem. Avisamos o organizador que você não vai participar.");
  });
}

export async function contactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, "t", 80);
  const email = text(form, "email", 250);
  const phone = text(form, "phone", 40);
  const fieldErrors: Record<string, string> = {};
  if (email && !isEmail(email)) fieldErrors.email = "Confira o e-mail.";
  if (phone && !normalizePhone(phone)) fieldErrors.phone = "Use DDD + número. Ex.: (11) 98765-4321";
  if (Object.keys(fieldErrors).length) return failed("Confira os campos destacados.", fieldErrors);
  return guard(async () => {
    const { me: p } = await me(token);
    await q.updateMyContact(p, email.toLowerCase() || null, normalizePhone(phone));
    refresh(token);
    return done("Contato salvo.");
  });
}

export async function addWishAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, "t", 80);
  const description = text(form, "description", 200);
  let link: string | null = text(form, "link", 500) || null;
  if (!description) return failed("Escreva a sugestão de presente.", { description: "Escreva a sugestão de presente." });
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  if (link) {
    try {
      const u = new URL(link);
      if (!u.hostname.includes(".")) throw new Error();
    } catch {
      return failed("O link não parece válido.", { link: "Cole o endereço completo da loja ou deixe em branco." });
    }
  }
  return guard(async () => {
    const { me: p, group } = await me(token);
    await q.addWish(p, group, description, link);
    refresh(token);
    return done("Sugestão adicionada.");
  });
}

export async function deleteWishAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, "t", 80);
  return guard(async () => {
    const { me: p, group } = await me(token);
    await q.deleteWish(p, group, text(form, "id", 40));
    refresh(token);
    return done("Sugestão removida.");
  });
}

export async function preferencesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, "t", 80);
  const prefs = String(form.get("preferences") ?? "").trim();
  if (prefs.length > 500) return failed("Use até 500 caracteres.", { preferences: "Use até 500 caracteres." });
  return guard(async () => {
    const { me: p, group } = await me(token);
    await q.updatePreferences(p, group, prefs || null);
    refresh(token);
    return done("Preferências salvas.");
  });
}

export type RevealResult =
  | { ok: true; name: string; firstSeenAt: string | null; preferences: string | null; wishes: q.Wish[] }
  | { ok: false; error: string };

/**
 * Busca o resultado só quando a pessoa pede para ver.
 * Assim o nome nunca vai no HTML da página e não aparece por acidente.
 */
export async function revealAction(token: string): Promise<RevealResult> {
  try {
    const { me: p, group } = await me(String(token));
    if (group.status !== "drawn") return { ok: false, error: "O sorteio ainda não foi feito." };
    const match = await q.getMyMatch(p, group);
    if (!match) return { ok: false, error: "Você não entrou neste sorteio. Fale com o organizador." };
    await q.markSeen(p);
    return {
      ok: true,
      name: match.name,
      firstSeenAt: match.firstSeenAt ? match.firstSeenAt.toISOString() : null,
      preferences: match.preferences,
      wishes: match.wishes,
    };
  } catch (e) {
    if (e instanceof q.AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não conseguimos buscar seu resultado. Confira sua internet e tente de novo." };
  }
}
