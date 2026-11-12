"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as q from "@/lib/queries";
import { participantUrl, sendDrawNotice, sendPersonalInvite } from "@/lib/notify";
import {
  cleanGroup, cleanPerson, emptyGroup, validateGroup, validatePerson, type GroupInput,
} from "@/lib/validation";
import { bool, done, failed, guard, text, type ActionState } from "./state";

async function admin(token: string) {
  const g = await q.getGroupByAdminToken(token);
  if (!g) throw new q.AppError("Este link de organizador não funciona mais. Recupere seus links pelo e-mail.");
  return g;
}

const refresh = (token: string) => revalidatePath(`/o/${token}`, "layout");
const personFrom = (form: FormData) => ({
  name: text(form, "name", 100), email: text(form, "email", 250), phone: text(form, "phone", 40), team: text(form, "team", 60),
});

export async function addPersonAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  const person = personFrom(form);
  const errors = validatePerson(person);
  if (Object.keys(errors).length) return failed("Confira os campos destacados.", errors);
  return guard(async () => {
    const g = await admin(t);
    const id = await q.addParticipant(g, cleanPerson(person));
    let msg = `${person.name.trim()} foi adicionado.`;
    if (bool(form, "send") && (person.email || person.phone)) {
      const p = await q.getParticipant(g, id);
      const channels = await sendPersonalInvite(p, g, await q.participantToken(id));
      if (channels.length) {
        await q.markInviteSent(id);
        msg += channels.includes("email") ? " Enviamos o link por e-mail." : " Enviamos o link pelo WhatsApp.";
      }
    }
    refresh(t);
    return done(msg);
  });
}

export async function editPersonAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  const person = personFrom(form);
  const errors = validatePerson(person);
  if (Object.keys(errors).length) return failed("Confira os campos destacados.", errors);
  return guard(async () => {
    const g = await admin(t);
    await q.updateParticipant(g, text(form, "id", 40), cleanPerson(person));
    refresh(t);
    return done("Dados salvos.");
  });
}

export async function removePersonAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  return guard(async () => {
    const g = await admin(t);
    await q.removeParticipant(g, text(form, "id", 40));
    refresh(t);
    return done("Participante removido.");
  });
}

/** Reenvia o link da pessoa pelo servidor (e-mail/WhatsApp), sem mostrá-lo ao organizador. */
export async function resendInviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  return guard(async () => {
    const g = await admin(t);
    const p = await q.getParticipant(g, text(form, "id", 40));
    const channels = await sendPersonalInvite(p, g, await q.participantToken(p.id));
    if (!channels.length) return failed(`${p.display_name} não tem e-mail cadastrado. Use "Enviar pelo WhatsApp" ou cadastre um e-mail.`);
    await q.markInviteSent(p.id);
    refresh(t);
    return done(channels.includes("email") ? `Link reenviado para o e-mail de ${p.display_name}.` : `Link reenviado pelo WhatsApp de ${p.display_name}.`);
  });
}

export type LinkResult = { ok: true; url: string; text: string; phone: string | null } | { ok: false; error: string };

/**
 * Link individual para o organizador repassar (WhatsApp ou copiar).
 * regenerate = true troca o link: o antigo para de funcionar.
 */
export async function personalLinkAction(t: string, id: string, regenerate = false): Promise<LinkResult> {
  try {
    const g = await admin(String(t));
    const p = await q.getParticipant(g, String(id));
    const token = regenerate ? await q.regenerateParticipantToken(g, p.id) : await q.participantToken(p.id);
    await q.markInviteSent(p.id);
    const { personalInviteText } = await import("@/lib/notify");
    refresh(String(t));
    return { ok: true, url: participantUrl(token), text: personalInviteText(p.display_name, g, token), phone: p.phone };
  } catch (e) {
    if (e instanceof q.AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não conseguimos gerar o link. Tente de novo." };
  }
}

export async function addRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  const a = text(form, "a", 40);
  const b = text(form, "b", 40);
  if (!a || !b) return failed("Escolha as duas pessoas.");
  return guard(async () => {
    const g = await admin(t);
    await q.addExclusion(g, a, b, text(form, "direction") === "one");
    refresh(t);
    return done("Regra adicionada.");
  });
}

export async function deleteRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  return guard(async () => {
    const g = await admin(t);
    await q.deleteExclusion(g, text(form, "id", 40));
    refresh(t);
    return done("Regra removida.");
  });
}

export async function setTeamAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  const team = text(form, "team", 60);
  if (team.length > 40) return failed("Use até 40 caracteres no nome do núcleo.");
  return guard(async () => {
    const g = await admin(t);
    await q.setTeam(g, text(form, "id", 40), team || null);
    refresh(t);
    return done("Núcleo salvo.");
  });
}

export type DrawState = ActionState & { problem?: q.NamedProblem; needsForce?: boolean };

export async function drawAction(_: DrawState, form: FormData): Promise<DrawState> {
  const t = text(form, "t", 80);
  const force = bool(form, "force");
  try {
    const g = await admin(t);
    const { redraw } = await q.runDraw(g, { force });
    // Avisa cada participante com o próprio link (o organizador não vê nenhum resultado).
    const people = await q.drawRecipients(g.id);
    await Promise.allSettled(people.map(async (p) => sendDrawNotice(p, g, await q.participantToken(p.id), redraw)));
    refresh(t);
    return done(redraw ? "Sorteio refeito. Avisamos quem tem e-mail ou WhatsApp cadastrado." : "Sorteio feito! Avisamos quem tem e-mail ou WhatsApp cadastrado.");
  } catch (e) {
    if (e instanceof q.DrawError) return { ...failed(e.message), problem: e.problem };
    if (e instanceof q.AppError) return { ...failed(e.message), needsForce: e.message.startsWith("Alguém já viu") };
    console.error(e);
    return failed("Não conseguimos fazer o sorteio agora. Nada foi alterado; tente de novo.");
  }
}

export async function resetDrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  if (!bool(form, "confirm")) return failed("Marque a confirmação para desfazer o sorteio.");
  return guard(async () => {
    const g = await admin(t);
    await q.resetDraw(g);
    refresh(t);
    return done("Sorteio desfeito. O grupo está aberto de novo.");
  });
}

export type PairsResult = { ok: true; pairs: { giver: string; receiver: string }[] } | { ok: false; error: string };

export async function pairsAction(t: string): Promise<PairsResult> {
  try {
    const g = await admin(String(t));
    return { ok: true, pairs: await q.listAllPairs(g) };
  } catch (e) {
    if (e instanceof q.AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não conseguimos carregar os pares." };
  }
}

export type EditResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string | undefined> };

export async function updateGroupAction(t: string, raw: GroupInput): Promise<EditResult> {
  const input: GroupInput = { ...emptyGroup };
  for (const k of Object.keys(emptyGroup) as (keyof GroupInput)[]) {
    const v = raw?.[k];
    (input as Record<string, unknown>)[k] = typeof emptyGroup[k] === "boolean" ? v === true : String(v ?? "").slice(0, 600);
  }
  const fieldErrors = validateGroup(input);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Alguns campos precisam de ajuste.", fieldErrors };
  try {
    const g = await admin(String(t));
    await q.updateGroup(g, cleanGroup(input));
    refresh(String(t));
    return { ok: true };
  } catch (e) {
    if (e instanceof q.AppError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não conseguimos salvar agora. Tente de novo." };
  }
}

export async function deleteGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = text(form, "t", 80);
  const g = await q.getGroupByAdminToken(t);
  if (!g) return failed("Este grupo não existe mais.");
  if (text(form, "confirm_name", 100).toLocaleLowerCase("pt-BR") !== g.name.trim().toLocaleLowerCase("pt-BR")) {
    return failed("Digite o nome do grupo exatamente como aparece para confirmar.", { confirm_name: "O nome não confere." });
  }
  const res = await guard(async () => {
    await q.deleteGroup(g);
    return done();
  });
  if (!res.ok) return res;
  redirect("/?apagado=1");
}
