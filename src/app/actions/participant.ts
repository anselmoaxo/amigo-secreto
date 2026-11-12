"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import * as q from "@/lib/queries";
import { sendPersonalInvite } from "@/lib/notify";
import { cleanPerson, isEmail, normalizePhone, validatePerson } from "@/lib/validation";
import { limitIp, limitResource, participantFromToken as me } from "@/lib/access";
import { logError } from "@/lib/log";
import { bool, done, failed, guard, knownError, text, type ActionState } from "./state";

const refresh = (token: string) => revalidatePath(`/p/${token}`);

export type JoinState = ActionState & { token?: string };

/** Entrar pelo convite geral do grupo. */
export async function joinAction(_: JoinState, form: FormData): Promise<JoinState> {
  const person = { name: text(form, "name", 100), email: text(form, "email", 250), phone: text(form, "phone", 40), team: "" };
  const errors = validatePerson(person);
  if (Object.keys(errors).length) return failed("Confira os campos destacados.", errors);
  if (!bool(form, "consent")) return failed("Para entrar, confirme que leu como usamos seus dados.", { consent: "Marque para continuar." });
  const result = await guard(async () => {
    const code = text(form, "code", 40);
    await limitIp("joinPerIp");
    await limitResource("joinPerInvite", code, 1, "Muita gente entrando neste grupo agora. Espere alguns minutos e tente de novo.");
    const token = await q.joinByInvite(code, cleanPerson(person));
    if (person.email) {
      // Manda o link para a pessoa guardar; se o e-mail falhar, ela continua com o link na tela.
      const res = await q.getByAccessToken(token);
      if (res) await sendPersonalInvite(res.me, res.group, token).catch((e) => logError("convite", e));
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
      // Só http(s), com domínio de verdade e sem usuário/senha no endereço (truque comum de phishing).
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || u.username || u.password) throw new Error();
      link = u.toString();
      if (link.length > 500) throw new Error();
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
  | { ok: true; name: string; firstSeenAt: string | null; otherDevice: boolean; preferences: string | null; wishes: q.Wish[] }
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
    const { otherDevice } = await q.markSeen(p, await deviceHash(p.id));
    return {
      ok: true,
      name: match.name,
      firstSeenAt: match.firstSeenAt ? match.firstSeenAt.toISOString() : null,
      otherDevice,
      preferences: match.preferences,
      wishes: match.wishes,
    };
  } catch (e) {
    const known = knownError(e);
    if (known) return { ok: false, error: known };
    logError("resultado", e);
    return { ok: false, error: "Não conseguimos buscar seu resultado. Confira sua internet e tente de novo." };
  }
}

/**
 * Identificador deste aparelho para o resultado (cookie aleatório, HttpOnly, só no caminho /p).
 * Não identifica a pessoa: serve só para avisar "este papelzinho foi aberto antes em outro aparelho".
 */
async function deviceHash(participantId: string) {
  try {
    const jar = await cookies();
    let id = jar.get("papel_aparelho")?.value;
    if (!id || !/^[A-Za-z0-9_-]{22,64}$/.test(id)) {
      id = crypto.randomBytes(16).toString("base64url");
      jar.set("papel_aparelho", id, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/p", maxAge: 60 * 60 * 24 * 400,
      });
    }
    return crypto.createHash("sha256").update(`${participantId}|${id}`).digest("hex");
  } catch {
    return null;
  }
}
