import crypto from "node:crypto";
import { sql } from "./db";
import { drawPairs } from "./draw";

/**
 * Todo acesso ao banco passa por aqui, e cada função confere a permissão.
 * Regras: só membros veem o grupo; só o organizador mexe nas regras e no sorteio;
 * cada participante só vê o próprio par (nem o organizador vê os outros).
 */

export class AppError extends Error {}

export type Group = {
  id: string; name: string; owner_id: string; event_date: string | null; location: string | null;
  min_value: string | null; max_value: string | null; status: "open" | "drawn"; invite_code: string;
};
export type Participant = { id: string; display_name: string; user_id: string };
export type Wish = { id: string; description: string; link: string | null };

const GROUP_COLS = sql`g.id, g.name, g.owner_id, to_char(g.event_date, 'YYYY-MM-DD') as event_date,
  g.location, g.min_value, g.max_value, g.status, g.invite_code`;

export async function listMyGroups(userId: string) {
  return sql<Group[]>`
    select ${GROUP_COLS} from groups g
    join participants p on p.group_id = g.id and p.user_id = ${userId}
    order by g.created_at desc`;
}

export async function createGroup(
  userId: string,
  data: { name: string; displayName: string; eventDate: string | null; location: string | null; min: number | null; max: number | null },
) {
  return sql.begin(async (tx) => {
    const [g] = await tx<{ id: string }[]>`
      insert into groups (name, owner_id, event_date, location, min_value, max_value, invite_code)
      values (${data.name}, ${userId}, ${data.eventDate}, ${data.location}, ${data.min}, ${data.max},
              ${crypto.randomBytes(6).toString("hex")})
      returning id`;
    await tx`insert into participants (group_id, user_id, display_name) values (${g.id}, ${userId}, ${data.displayName})`;
    return g.id;
  });
}

/** Grupo + meu participante. null se não sou membro. */
export async function getGroupForMember(groupId: string, userId: string) {
  if (!isUuid(groupId)) return null;
  const [row] = await sql<(Group & { me_id: string })[]>`
    select ${GROUP_COLS}, p.id as me_id from groups g
    join participants p on p.group_id = g.id and p.user_id = ${userId}
    where g.id = ${groupId}`;
  return row ?? null;
}

export async function getInvite(code: string) {
  const [row] = await sql<(Group & { members: number })[]>`
    select ${GROUP_COLS}, (select count(*)::int from participants p where p.group_id = g.id) as members
    from groups g where g.invite_code = ${code}`;
  return row ?? null;
}

export async function joinGroup(code: string, userId: string, displayName: string) {
  const g = await getInvite(code);
  if (!g) throw new AppError("Convite inválido.");
  const [already] = await sql`select 1 from participants where group_id = ${g.id} and user_id = ${userId}`;
  if (already) return g.id;
  if (g.status !== "open") throw new AppError("O sorteio deste grupo já foi feito.");
  await sql`
    insert into participants (group_id, user_id, display_name) values (${g.id}, ${userId}, ${displayName})
    on conflict (group_id, user_id) do nothing`;
  return g.id;
}

export async function listParticipants(groupId: string) {
  return sql<Participant[]>`
    select id, display_name, user_id from participants where group_id = ${groupId} order by joined_at`;
}

// Lista de desejos ------------------------------------------------------
export async function listWishes(participantId: string) {
  return sql<Wish[]>`select id, description, link from wishes where participant_id = ${participantId} order by created_at`;
}

export async function addWish(groupId: string, userId: string, description: string, link: string | null) {
  const g = await getGroupForMember(groupId, userId);
  if (!g) throw new AppError("Você não está neste grupo.");
  await sql`insert into wishes (participant_id, description, link) values (${g.me_id}, ${description}, ${link})`;
}

export async function deleteWish(wishId: string, userId: string) {
  if (!isUuid(wishId)) return;
  await sql`
    delete from wishes w using participants p
    where w.id = ${wishId} and w.participant_id = p.id and p.user_id = ${userId}`;
}

// Sorteio -----------------------------------------------------------------
/** Quem eu tirei, com a lista de desejos. Só a minha linha. */
export async function getMyMatch(groupId: string, userId: string) {
  const [row] = await sql<{ id: string; display_name: string }[]>`
    select r.id, r.display_name from assignments a
    join participants me on me.id = a.giver_id and me.user_id = ${userId}
    join participants r on r.id = a.receiver_id
    where a.group_id = ${groupId}`;
  if (!row) return null;
  return { name: row.display_name, wishes: await listWishes(row.id) };
}

export async function markSeen(groupId: string, userId: string) {
  if (!isUuid(groupId)) return;
  await sql`
    update assignments a set seen_at = coalesce(a.seen_at, now())
    from participants p
    where a.giver_id = p.id and p.user_id = ${userId} and a.group_id = ${groupId}`;
}

// Organizador -------------------------------------------------------------
async function requireOwner(groupId: string, userId: string) {
  const g = await getGroupForMember(groupId, userId);
  if (!g || g.owner_id !== userId) throw new AppError("Só o organizador pode fazer isso.");
  return g;
}

export async function listExclusions(groupId: string, userId: string) {
  await requireOwner(groupId, userId);
  return sql<{ id: string; participant_a: string; participant_b: string }[]>`
    select id, participant_a, participant_b from exclusions where group_id = ${groupId}`;
}

export async function addExclusion(groupId: string, userId: string, a: string, b: string) {
  const g = await requireOwner(groupId, userId);
  if (g.status !== "open") throw new AppError("Desfaça o sorteio antes de mudar as regras.");
  if (!isUuid(a) || !isUuid(b) || a === b) throw new AppError("Escolha duas pessoas diferentes.");
  const rows = await sql`select id from participants where group_id = ${groupId} and id in (${a}, ${b})`;
  if (rows.length !== 2) throw new AppError("Pessoa não encontrada no grupo.");
  await sql`insert into exclusions (group_id, participant_a, participant_b) values (${groupId}, ${a}, ${b})`;
}

export async function deleteExclusion(groupId: string, userId: string, id: string) {
  await requireOwner(groupId, userId);
  if (!isUuid(id)) return;
  await sql`delete from exclusions where id = ${id} and group_id = ${groupId}`;
}

/** Remove alguém (organizador) ou sai do grupo (a própria pessoa). Só antes do sorteio. */
export async function removeParticipant(groupId: string, userId: string, participantId: string) {
  const g = await getGroupForMember(groupId, userId);
  if (!g || !isUuid(participantId)) throw new AppError("Grupo não encontrado.");
  if (g.status !== "open") throw new AppError("Desfaça o sorteio antes de remover alguém.");
  const [target] = await sql<{ user_id: string }[]>`
    select user_id from participants where id = ${participantId} and group_id = ${groupId}`;
  if (!target) return;
  if (target.user_id === g.owner_id) throw new AppError("O organizador não pode sair do grupo.");
  if (g.owner_id !== userId && target.user_id !== userId) throw new AppError("Só o organizador pode remover pessoas.");
  await sql`delete from participants where id = ${participantId}`;
}

/** Faz ou refaz o sorteio. Devolve quem deve ser avisado. */
export async function runDraw(groupId: string, userId: string, random: () => number = Math.random) {
  await requireOwner(groupId, userId);
  return sql.begin(async (tx) => {
    const [g] = await tx<{ name: string }[]>`select name from groups where id = ${groupId} for update`;
    const people = await tx<{ id: string; display_name: string; email: string }[]>`
      select p.id, p.display_name, u.email from participants p join users u on u.id = p.user_id
      where p.group_id = ${groupId}`;
    if (people.length < 3) throw new AppError("São precisas pelo menos 3 pessoas para sortear.");
    const rules = await tx<{ participant_a: string; participant_b: string }[]>`
      select participant_a, participant_b from exclusions where group_id = ${groupId}`;
    const pairs = drawPairs(
      people.map((p) => p.id),
      rules.map((r) => [r.participant_a, r.participant_b] as [string, string]),
      random,
    );
    if (!pairs) throw new AppError("Com essas regras não dá para sortear. Remova alguma regra e tente de novo.");

    await tx`delete from assignments where group_id = ${groupId}`;
    for (const p of pairs) {
      await tx`insert into assignments (group_id, giver_id, receiver_id) values (${groupId}, ${p.giver}, ${p.receiver})`;
    }
    await tx`update groups set status = 'drawn', drawn_at = now() where id = ${groupId}`;
    return { groupName: g.name, people };
  });
}

export async function reopenGroup(groupId: string, userId: string) {
  await requireOwner(groupId, userId);
  await sql.begin(async (tx) => {
    await tx`delete from assignments where group_id = ${groupId}`;
    await tx`update groups set status = 'open', drawn_at = null where id = ${groupId}`;
  });
}

// Lembretes ---------------------------------------------------------------
export async function participantsWithEventOn(date: string) {
  return sql<{ group_id: string; group_name: string; display_name: string; email: string; phone: string | null }[]>`
    select g.id as group_id, g.name as group_name, p.display_name, u.email, p.phone
    from groups g join participants p on p.group_id = g.id join users u on u.id = p.user_id
    where g.status = 'drawn' and g.event_date = ${date}`;
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
