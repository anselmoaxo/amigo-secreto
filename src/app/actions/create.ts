"use server";

import * as q from "@/lib/queries";
import { sendOrganizerLinks, sendPersonalInvite } from "@/lib/notify";
import { limitIp } from "@/lib/access";
import { logError } from "@/lib/log";
import { knownError } from "./state";
import {
  cleanGroup, cleanPerson, emptyGroup, validateGroup, validatePerson, type Errors, type GroupInput, type PersonInput,
} from "@/lib/validation";

export type CreateResult =
  | { ok: true; adminToken: string; myToken: string | null; groupName: string }
  | { ok: false; error: string; fieldErrors?: Errors; personErrors?: Record<number, Errors> };

/** Recebe os dados do formulário em etapas e cria o grupo. */
export async function createGroupAction(raw: { group: GroupInput; people: PersonInput[]; sendInvites: boolean }): Promise<CreateResult> {
  // Não confiamos no que veio do navegador: só os campos conhecidos, com tipos certos.
  const input: GroupInput = { ...emptyGroup };
  for (const k of Object.keys(emptyGroup) as (keyof GroupInput)[]) {
    const v = raw?.group?.[k];
    (input as Record<string, unknown>)[k] = typeof emptyGroup[k] === "boolean" ? v === true : String(v ?? "").slice(0, 600);
  }
  const people: PersonInput[] = (Array.isArray(raw?.people) ? raw.people : []).slice(0, q.MAX_PEOPLE).map((p) => ({
    name: String(p?.name ?? "").slice(0, 100),
    email: String(p?.email ?? "").slice(0, 250),
    phone: String(p?.phone ?? "").slice(0, 40),
    team: String(p?.team ?? "").slice(0, 60),
  }));

  const fieldErrors = validateGroup(input, { isNew: true });
  const personErrors: Record<number, Errors> = {};
  people.forEach((p, i) => {
    const e = validatePerson(p);
    if (Object.keys(e).length) personErrors[i] = e;
  });
  if (Object.keys(fieldErrors).length || Object.keys(personErrors).length) {
    return { ok: false, error: "Alguns campos precisam de ajuste.", fieldErrors, personErrors };
  }

  try {
    const group = cleanGroup(input);
    const persons = people.map(cleanPerson);
    // Limites antes de gravar: criar grupos em série e disparar convites para listas de endereços é o abuso mais provável.
    await limitIp("createPerIp");
    const outgoing = (group.organizerEmail ? 1 : 0) + (raw.sendInvites === true ? persons.filter((p) => p.email || p.phone).length : 0);
    if (outgoing) await limitIp("messagesPerIp", outgoing);
    const res = await q.createGroup(group, persons);

    if (group.organizerEmail) await sendOrganizerLinks(group.organizerEmail, { name: group.name }, res.adminToken, res.myToken);
    if (raw.sendInvites === true) {
      const g = await q.getGroupByAdminToken(res.adminToken);
      const list = await q.listParticipants(res.groupId);
      for (const p of list.filter((p) => !p.is_organizer && (p.email || p.phone))) {
        const channels = await sendPersonalInvite(p, g!, await q.participantToken(p.id));
        if (channels.length) await q.markInviteSent(p.id);
      }
    }
    return { ok: true, adminToken: res.adminToken, myToken: res.myToken, groupName: group.name };
  } catch (e) {
    const known = knownError(e);
    if (known) return { ok: false, error: known };
    logError("criar grupo", e);
    return { ok: false, error: "Não conseguimos criar o grupo agora. Seus dados continuam aqui; tente de novo em instantes." };
  }
}
