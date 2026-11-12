"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient, getUser } from "@/lib/supabase/server";
import { drawPairs } from "@/lib/draw";
import { drawEmail, sendEmail } from "@/lib/email";
import { safeNext, siteUrl } from "@/lib/format";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = text(f, k).replace(",", ".");
  return v === "" ? null : Number(v);
};

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}erro=${encodeURIComponent(message)}`);
}

async function requireUser(next: string) {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

// Login ----------------------------------------------------------------
export async function sendMagicLink(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const next = safeNext(text(form, "next"));
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(`/login?next=${encodeURIComponent(next)}`, "E-mail inválido.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) fail(`/login?next=${encodeURIComponent(next)}`, "Não deu para enviar o link. Tente de novo em instantes.");
  redirect(`/login?enviado=${encodeURIComponent(email)}`);
}

// Grupos ---------------------------------------------------------------
export async function createGroup(form: FormData) {
  const { supabase } = await requireUser("/grupos/novo");
  const name = text(form, "name");
  const displayName = text(form, "display_name");
  const min = num(form, "min_value");
  const max = num(form, "max_value");
  if (!name || !displayName) fail("/grupos/novo", "Preencha o nome do grupo e o seu nome.");
  if ((min !== null && isNaN(min)) || (max !== null && isNaN(max))) fail("/grupos/novo", "Valor inválido.");
  if (min !== null && max !== null && min > max) fail("/grupos/novo", "O valor mínimo é maior que o máximo.");

  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_display_name: displayName,
    p_event_date: text(form, "event_date") || null,
    p_location: text(form, "location"),
    p_min: min,
    p_max: max,
  });
  if (error) fail("/grupos/novo", "Não foi possível criar o grupo.");
  redirect(`/grupos/${data}`);
}

export async function joinGroup(form: FormData) {
  const code = text(form, "code");
  const { supabase } = await requireUser(`/g/${code}`);
  const displayName = text(form, "display_name");
  if (!displayName) fail(`/g/${code}`, "Diga seu nome.");
  const { data, error } = await supabase.rpc("join_group", { p_code: code, p_display_name: displayName });
  if (error) fail(`/g/${code}`, error.message);
  redirect(`/grupos/${data}`);
}

// Lista de desejos -----------------------------------------------------
export async function addWish(form: FormData) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const { supabase, user } = await requireUser(path);
  const description = text(form, "description");
  let link: string | null = text(form, "link") || null;
  if (!description) fail(path, "Escreva o que você quer ganhar.");
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;

  const { data: me } = await supabase
    .from("participants").select("id").eq("group_id", groupId).eq("user_id", user.id).single();
  if (!me) fail(path, "Você não está neste grupo.");
  const { error } = await supabase.from("wishes").insert({ participant_id: me.id, description, link });
  if (error) fail(path, "Não foi possível salvar o desejo.");
  revalidatePath(path);
}

export async function deleteWish(form: FormData) {
  const groupId = text(form, "group_id");
  const { supabase } = await requireUser(`/grupos/${groupId}`);
  await supabase.from("wishes").delete().eq("id", text(form, "id"));
  revalidatePath(`/grupos/${groupId}`);
}

// Painel do organizador ------------------------------------------------
export async function removeParticipant(form: FormData) {
  const groupId = text(form, "group_id");
  const { supabase } = await requireUser(`/grupos/${groupId}`);
  const { error } = await supabase.from("participants").delete().eq("id", text(form, "participant_id"));
  if (error) fail(`/grupos/${groupId}`, "Não foi possível remover.");
  revalidatePath(`/grupos/${groupId}`);
}

export async function addExclusion(form: FormData) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const { supabase } = await requireUser(path);
  const a = text(form, "a");
  const b = text(form, "b");
  if (!a || !b || a === b) fail(path, "Escolha duas pessoas diferentes.");
  const { error } = await supabase.from("exclusions").insert({ group_id: groupId, participant_a: a, participant_b: b });
  if (error) fail(path, "Não foi possível salvar a regra.");
  revalidatePath(path);
}

export async function deleteExclusion(form: FormData) {
  const groupId = text(form, "group_id");
  const { supabase } = await requireUser(`/grupos/${groupId}`);
  await supabase.from("exclusions").delete().eq("id", text(form, "id"));
  revalidatePath(`/grupos/${groupId}`);
}

/** Faz (ou refaz) o sorteio. Só o organizador; o resultado é gravado com a chave de serviço. */
export async function runDraw(form: FormData) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const { supabase, user } = await requireUser(path);

  const { data: group } = await supabase.from("groups").select("id, name, owner_id").eq("id", groupId).single();
  if (!group || group.owner_id !== user.id) fail(path, "Só o organizador pode sortear.");

  const [{ data: people }, { data: rules }] = await Promise.all([
    supabase.from("participants").select("id, display_name, email").eq("group_id", groupId),
    supabase.from("exclusions").select("participant_a, participant_b").eq("group_id", groupId),
  ]);
  if (!people || people.length < 3) fail(path, "São precisas pelo menos 3 pessoas para sortear.");

  const pairs = drawPairs(
    people.map((p) => p.id),
    (rules ?? []).map((r) => [r.participant_a, r.participant_b] as [string, string]),
  );
  if (!pairs) fail(path, "Com essas regras não dá para sortear. Remova alguma regra e tente de novo.");

  const admin = createAdminClient();
  const del = await admin.from("assignments").delete().eq("group_id", groupId);
  if (del.error) fail(path, "Erro ao preparar o sorteio.");
  const ins = await admin.from("assignments").insert(
    pairs.map((p) => ({ group_id: groupId, giver_id: p.giver, receiver_id: p.receiver })),
  );
  if (ins.error) fail(path, "Erro ao gravar o sorteio.");
  await admin.from("groups").update({ status: "drawn", drawn_at: new Date().toISOString() }).eq("id", groupId);

  await Promise.all(
    people.filter((p) => p.email).map((p) =>
      sendEmail(p.email!, `🎁 Sorteio feito: ${group.name}`, drawEmail(p.display_name, group.name, groupId)),
    ),
  );
  revalidatePath(path);
}

/** Desfaz o sorteio e reabre o grupo para novas pessoas. */
export async function reopenGroup(form: FormData) {
  const groupId = text(form, "group_id");
  const path = `/grupos/${groupId}`;
  const { supabase, user } = await requireUser(path);
  const { data: group } = await supabase.from("groups").select("owner_id").eq("id", groupId).single();
  if (!group || group.owner_id !== user.id) fail(path, "Só o organizador pode reabrir.");
  const admin = createAdminClient();
  await admin.from("assignments").delete().eq("group_id", groupId);
  await admin.from("groups").update({ status: "open", drawn_at: null }).eq("id", groupId);
  revalidatePath(path);
}

export async function markSeen(groupId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_seen", { p_group: groupId });
}
