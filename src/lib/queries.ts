import "server-only";
import { sql } from "./db";
import { checkDraw, drawPairs, type DrawProblem, type RandInt, secureRandInt } from "./draw";
import { decryptToken, hashToken, issueToken, looksLikeToken, newInviteCode } from "./tokens";
import { todayBR, type CleanGroup, type CleanPerson } from "./validation";

/**
 * Todo acesso ao banco passa por aqui.
 * Não há contas: o organizador chega pelo link de administração e cada participante
 * pelo próprio link. As funções recebem o grupo/participante já resolvido pelo token
 * e conferem o resto (sorteio feito, alterações permitidas, prazos).
 * Ninguém vê os pares dos outros; o organizador só vê se marcou isso ao criar o grupo.
 */

export class AppError extends Error {}

export const MAX_PEOPLE = 200;

export type Group = {
  id: string;
  name: string;
  occasion: string;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  min_value: string | null;
  max_value: string | null;
  description: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  rsvp_deadline: string | null;
  wishlist_enabled: boolean;
  wishlist_until: string | null;
  allow_changes: boolean;
  organizer_can_see_pairs: boolean;
  status: "open" | "drawn";
  invite_code: string;
  drawn_at: Date | null;
};

export type Participant = {
  id: string;
  group_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: "pending" | "confirmed" | "declined";
  team: string | null;
  preferences: string | null;
  is_organizer: boolean;
  invite_sent_at: Date | null;
  revealed: boolean;
};

export type Wish = { id: string; description: string; link: string | null };

const GROUP_COLS = sql`g.id, g.name, g.occasion, to_char(g.event_date, 'YYYY-MM-DD') as event_date,
  to_char(g.event_time, 'HH24:MI') as event_time, g.location, g.min_value, g.max_value, g.description,
  g.organizer_name, g.organizer_email, to_char(g.rsvp_deadline, 'YYYY-MM-DD') as rsvp_deadline,
  g.wishlist_enabled, to_char(g.wishlist_until, 'YYYY-MM-DD') as wishlist_until, g.allow_changes,
  g.organizer_can_see_pairs, g.status, g.invite_code, g.drawn_at`;

const PERSON_COLS = sql`p.id, p.group_id, p.display_name, p.email, p.phone, p.status, p.team, p.preferences,
  p.is_organizer, p.invite_sent_at,
  exists(select 1 from assignments a where a.giver_id = p.id and a.seen_at is not null) as revealed`;

// Criação ----------------------------------------------------------------------

export async function createGroup(g: CleanGroup, people: CleanPerson[]) {
  if (people.length + (g.organizerJoins ? 1 : 0) > MAX_PEOPLE) throw new AppError(`O limite é de ${MAX_PEOPLE} pessoas por grupo.`);
  assertUniqueNames([...(g.organizerJoins ? [g.organizerName] : []), ...people.map((p) => p.name)]);

  const admin = issueToken();
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into groups (name, occasion, event_date, event_time, location, min_value, max_value, description,
        organizer_name, organizer_email, rsvp_deadline, wishlist_enabled, wishlist_until, allow_changes,
        organizer_can_see_pairs, invite_code, admin_token_hash, admin_token_enc)
      values (${g.name}, ${g.occasion}, ${g.eventDate}, ${g.eventTime}, ${g.location}, ${g.minValue}, ${g.maxValue},
        ${g.description}, ${g.organizerName}, ${g.organizerEmail}, ${g.rsvpDeadline}, ${g.wishlistEnabled},
        ${g.wishlistUntil}, ${g.allowChanges}, ${g.organizerCanSeePairs}, ${newInviteCode()}, ${admin.hash}, ${admin.enc})
      returning id`;

    let myToken: string | null = null;
    if (g.organizerJoins) {
      const t = issueToken();
      myToken = t.token;
      await tx`
        insert into participants (group_id, display_name, email, phone, status, responded_at, is_organizer, access_token_hash, access_token_enc)
        values (${row.id}, ${g.organizerName}, ${g.organizerEmail}, ${g.organizerPhone}, 'confirmed', now(), true, ${t.hash}, ${t.enc})`;
    }
    for (const p of people) {
      const t = issueToken();
      await tx`
        insert into participants (group_id, display_name, email, phone, team, access_token_hash, access_token_enc)
        values (${row.id}, ${p.name}, ${p.email}, ${p.phone}, ${p.team}, ${t.hash}, ${t.enc})`;
    }
    return { groupId: row.id, adminToken: admin.token, myToken };
  });
}

function assertUniqueNames(names: string[]) {
  const seen = new Set<string>();
  for (const n of names) {
    const k = n.trim().toLocaleLowerCase("pt-BR");
    if (seen.has(k)) throw new AppError(`O nome "${n.trim()}" aparece duas vezes. Use também o sobrenome para diferenciar.`);
    seen.add(k);
  }
}

// Acesso por token -----------------------------------------------------------

/** Grupo pelo link de administração. */
export async function getGroupByAdminToken(token: string) {
  if (!looksLikeToken(token)) return null;
  const [g] = await sql<Group[]>`select ${GROUP_COLS} from groups g where g.admin_token_hash = ${hashToken(token)}`;
  return g ?? null;
}

/** Participante e grupo pelo link individual. */
export async function getByAccessToken(token: string) {
  if (!looksLikeToken(token)) return null;
  const [me] = await sql<Participant[]>`
    select ${PERSON_COLS} from participants p where p.access_token_hash = ${hashToken(token)}`;
  if (!me) return null;
  const [group] = await sql<Group[]>`select ${GROUP_COLS} from groups g where g.id = ${me.group_id}`;
  return { me, group };
}

export async function getInvite(code: string) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) return null;
  const [row] = await sql<(Group & { members: number })[]>`
    select ${GROUP_COLS}, (select count(*)::int from participants p where p.group_id = g.id and p.status <> 'declined') as members
    from groups g where g.invite_code = ${code}`;
  return row ?? null;
}

/** Por que o convite público não aceita mais gente (ou null se aceita). */
export function inviteClosedReason(g: Group): string | null {
  if (g.status === "drawn") return "O sorteio deste grupo já foi feito, então não dá mais para entrar.";
  if (!g.allow_changes) return "O organizador fechou a lista de participantes deste grupo.";
  if (g.rsvp_deadline && g.rsvp_deadline < todayBR()) return "O prazo para entrar neste grupo já terminou.";
  return null;
}

/** Entrada pelo convite público. Devolve o link individual da pessoa. */
export async function joinByInvite(code: string, p: CleanPerson) {
  const g = await getInvite(code);
  if (!g) throw new AppError("Convite não encontrado. Confira o link com quem te convidou.");
  const closed = inviteClosedReason(g);
  if (closed) throw new AppError(closed);
  if (g.members >= MAX_PEOPLE) throw new AppError("Este grupo já está cheio.");
  return sql.begin(async (tx) => {
    await tx`select id from groups where id = ${g.id} for update`;
    const [dup] = await tx`
      select 1 from participants where group_id = ${g.id} and lower(display_name) = lower(${p.name})`;
    if (dup) throw new AppError("Já tem alguém com esse nome no grupo. Se for você, peça seu link ao organizador. Se não, use também o sobrenome.");
    const t = issueToken();
    await tx`
      insert into participants (group_id, display_name, email, phone, status, responded_at, access_token_hash, access_token_enc)
      values (${g.id}, ${p.name}, ${p.email}, ${p.phone}, 'confirmed', now(), ${t.hash}, ${t.enc})`;
    return t.token;
  });
}

// Participante --------------------------------------------------------------

export async function respond(me: Participant, group: Group, answer: "confirmed" | "declined") {
  if (group.status === "drawn") throw new AppError("O sorteio já foi feito. Fale com o organizador se não puder mais participar.");
  if (answer === "declined" && me.is_organizer) throw new AppError("Para sair, desmarque sua participação na edição do grupo.");
  await sql`update participants set status = ${answer}, responded_at = now() where id = ${me.id}`;
}

export async function updateMyContact(me: Participant, email: string | null, phone: string | null) {
  await sql`update participants set email = ${email}, phone = ${phone} where id = ${me.id}`;
}

/** A lista de desejos aceita mudanças? */
export function wishlistOpen(g: Group) {
  if (!g.wishlist_enabled) return false;
  const today = todayBR();
  if (g.wishlist_until && today > g.wishlist_until) return false;
  if (g.event_date && today > g.event_date) return false;
  return true;
}

function assertWishlistOpen(g: Group) {
  if (!g.wishlist_enabled) throw new AppError("Este grupo não usa lista de desejos.");
  if (!wishlistOpen(g)) throw new AppError("O prazo para mudar a lista de desejos terminou.");
}

export async function listWishes(participantId: string) {
  return sql<Wish[]>`select id, description, link from wishes where participant_id = ${participantId} order by created_at`;
}

export async function addWish(me: Participant, group: Group, description: string, link: string | null) {
  assertWishlistOpen(group);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from wishes where participant_id = ${me.id}`;
  if (n >= 15) throw new AppError("A lista aceita até 15 sugestões.");
  await sql`insert into wishes (participant_id, description, link) values (${me.id}, ${description}, ${link})`;
}

export async function deleteWish(me: Participant, group: Group, wishId: string) {
  assertWishlistOpen(group);
  if (!isUuid(wishId)) return;
  await sql`delete from wishes where id = ${wishId} and participant_id = ${me.id}`;
}

export async function updatePreferences(me: Participant, group: Group, text: string | null) {
  assertWishlistOpen(group);
  await sql`update participants set preferences = ${text} where id = ${me.id}`;
}

/** Quem eu tirei. Só a minha linha do sorteio. */
export async function getMyMatch(me: Participant, group: Group) {
  const [row] = await sql<{ id: string; display_name: string; preferences: string | null; seen_at: Date | null }[]>`
    select r.id, r.display_name, r.preferences, a.seen_at from assignments a
    join participants r on r.id = a.receiver_id
    where a.giver_id = ${me.id}`;
  if (!row) return null;
  return {
    name: row.display_name,
    firstSeenAt: row.seen_at,
    preferences: group.wishlist_enabled ? row.preferences : null,
    wishes: group.wishlist_enabled ? await listWishes(row.id) : [],
  };
}

export async function markSeen(me: Participant) {
  await sql`update assignments set seen_at = coalesce(seen_at, now()) where giver_id = ${me.id}`;
}

// Organizador -----------------------------------------------------------------

export async function listParticipants(groupId: string) {
  return sql<Participant[]>`
    select ${PERSON_COLS} from participants p where p.group_id = ${groupId}
    order by p.is_organizer desc, p.joined_at, p.display_name`;
}

export async function updateGroup(group: Group, g: CleanGroup) {
  // Ver os pares só pode ser desligado depois de criado, nunca ligado.
  const canSee = group.organizer_can_see_pairs && g.organizerCanSeePairs;
  await sql.begin(async (tx) => {
    await tx`
      update groups set name = ${g.name}, occasion = ${g.occasion}, event_date = ${g.eventDate}, event_time = ${g.eventTime},
        location = ${g.location}, min_value = ${g.minValue}, max_value = ${g.maxValue}, description = ${g.description},
        organizer_name = ${g.organizerName}, organizer_email = ${g.organizerEmail}, rsvp_deadline = ${g.rsvpDeadline},
        wishlist_enabled = ${g.wishlistEnabled}, wishlist_until = ${g.wishlistUntil}, allow_changes = ${g.allowChanges},
        organizer_can_see_pairs = ${canSee}, updated_at = now()
      where id = ${group.id}`;
    const [org] = await tx<{ id: string }[]>`select id from participants where group_id = ${group.id} and is_organizer`;
    if (org && !g.organizerJoins) {
      if (group.status === "drawn") throw new AppError("O sorteio já foi feito. Desfaça o sorteio antes de sair dele.");
      await tx`delete from participants where id = ${org.id}`;
    } else if (!org && g.organizerJoins) {
      if (group.status === "drawn") throw new AppError("O sorteio já foi feito. Desfaça o sorteio antes de entrar nele.");
      const [dup] = await tx`select 1 from participants where group_id = ${group.id} and lower(display_name) = lower(${g.organizerName})`;
      if (dup) throw new AppError(`Já existe "${g.organizerName}" no grupo. Use também o sobrenome.`);
      const t = issueToken();
      await tx`
        insert into participants (group_id, display_name, email, phone, status, responded_at, is_organizer, access_token_hash, access_token_enc)
        values (${group.id}, ${g.organizerName}, ${g.organizerEmail}, ${g.organizerPhone}, 'confirmed', now(), true, ${t.hash}, ${t.enc})`;
    } else if (org) {
      await tx`
        update participants set display_name = ${g.organizerName}, email = coalesce(${g.organizerEmail}, email),
          phone = coalesce(${g.organizerPhone}, phone)
        where id = ${org.id}`;
    }
  });
}

function assertCanChangePeople(group: Group) {
  if (group.status === "drawn") throw new AppError("O sorteio já foi feito. Desfaça o sorteio antes de mudar os participantes.");
  if (!group.allow_changes) throw new AppError("Este grupo não permite mudar participantes. Você pode liberar isso em Editar grupo.");
}

export async function addParticipant(group: Group, p: CleanPerson) {
  assertCanChangePeople(group);
  return sql.begin(async (tx) => {
    await tx`select id from groups where id = ${group.id} for update`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from participants where group_id = ${group.id}`;
    if (n >= MAX_PEOPLE) throw new AppError(`O limite é de ${MAX_PEOPLE} pessoas por grupo.`);
    const [dup] = await tx`select 1 from participants where group_id = ${group.id} and lower(display_name) = lower(${p.name})`;
    if (dup) throw new AppError(`Já existe "${p.name}" no grupo. Use também o sobrenome para diferenciar.`);
    const t = issueToken();
    const [row] = await tx<{ id: string }[]>`
      insert into participants (group_id, display_name, email, phone, team, access_token_hash, access_token_enc)
      values (${group.id}, ${p.name}, ${p.email}, ${p.phone}, ${p.team}, ${t.hash}, ${t.enc}) returning id`;
    return row.id;
  });
}

export async function updateParticipant(group: Group, participantId: string, p: CleanPerson) {
  if (group.status === "drawn") throw new AppError("O sorteio já foi feito. Desfaça o sorteio antes de mudar os participantes.");
  const target = await getParticipant(group, participantId);
  const [dup] = await sql`
    select 1 from participants where group_id = ${group.id} and id <> ${target.id} and lower(display_name) = lower(${p.name})`;
  if (dup) throw new AppError(`Já existe "${p.name}" no grupo.`);
  await sql`
    update participants set display_name = ${p.name}, email = ${p.email}, phone = ${p.phone}, team = ${p.team}
    where id = ${target.id}`;
}

export async function removeParticipant(group: Group, participantId: string) {
  assertCanChangePeople(group);
  const target = await getParticipant(group, participantId);
  if (target.is_organizer) throw new AppError("Para sair do sorteio, desmarque sua participação em Editar grupo.");
  await sql`delete from participants where id = ${target.id}`;
}

export async function getParticipant(group: Group, participantId: string) {
  if (!isUuid(participantId)) throw new AppError("Participante não encontrado.");
  const [p] = await sql<(Participant & { access_token_enc: string | null })[]>`
    select ${PERSON_COLS}, p.access_token_enc from participants p where p.id = ${participantId} and p.group_id = ${group.id}`;
  if (!p) throw new AppError("Participante não encontrado. A lista pode ter mudado; recarregue a página.");
  return p;
}

/** Link individual atual (gera um se a pessoa ainda não tiver, caso de grupos antigos). */
export async function participantToken(participantId: string): Promise<string> {
  const [row] = await sql<{ access_token_enc: string | null }[]>`select access_token_enc from participants where id = ${participantId}`;
  const current = decryptToken(row?.access_token_enc ?? null);
  if (current) return current;
  const t = issueToken();
  await sql`update participants set access_token_hash = ${t.hash}, access_token_enc = ${t.enc} where id = ${participantId}`;
  return t.token;
}

/** Link de administração atual (gera um para grupos antigos). */
export async function adminToken(groupId: string): Promise<string> {
  const [row] = await sql<{ admin_token_enc: string | null }[]>`select admin_token_enc from groups where id = ${groupId}`;
  const current = decryptToken(row?.admin_token_enc ?? null);
  if (current) return current;
  const t = issueToken();
  await sql`update groups set admin_token_hash = ${t.hash}, admin_token_enc = ${t.enc} where id = ${groupId}`;
  return t.token;
}

/** Troca o link de alguém. O antigo para de funcionar. */
export async function regenerateParticipantToken(group: Group, participantId: string) {
  const target = await getParticipant(group, participantId);
  const t = issueToken();
  await sql`update participants set access_token_hash = ${t.hash}, access_token_enc = ${t.enc} where id = ${target.id}`;
  return t.token;
}

export async function markInviteSent(participantId: string) {
  await sql`update participants set invite_sent_at = now() where id = ${participantId}`;
}

// Regras --------------------------------------------------------------------

export type Exclusion = { id: string; participant_a: string; participant_b: string; one_way: boolean };

export async function listExclusions(groupId: string) {
  return sql<Exclusion[]>`
    select id, participant_a, participant_b, one_way from exclusions where group_id = ${groupId} order by id`;
}

export async function addExclusion(group: Group, a: string, b: string, oneWay: boolean) {
  if (group.status === "drawn") throw new AppError("Desfaça o sorteio antes de mudar as regras.");
  if (!isUuid(a) || !isUuid(b)) throw new AppError("Escolha duas pessoas.");
  if (a === b) throw new AppError("Escolha duas pessoas diferentes. Ninguém tira a si mesmo, isso já é automático.");
  const rows = await sql`select id from participants where group_id = ${group.id} and id in (${a}, ${b})`;
  if (rows.length !== 2) throw new AppError("Pessoa não encontrada no grupo. Recarregue a página.");
  const [dup] = await sql`
    select 1 from exclusions where group_id = ${group.id}
    and ((participant_a = ${a} and participant_b = ${b}) or (participant_a = ${b} and participant_b = ${a}))`;
  if (dup) throw new AppError("Já existe uma regra entre essas duas pessoas. Remova a antiga para trocar.");
  await sql`insert into exclusions (group_id, participant_a, participant_b, one_way) values (${group.id}, ${a}, ${b}, ${oneWay})`;
}

export async function deleteExclusion(group: Group, id: string) {
  if (group.status === "drawn") throw new AppError("Desfaça o sorteio antes de mudar as regras.");
  if (!isUuid(id)) return;
  await sql`delete from exclusions where id = ${id} and group_id = ${group.id}`;
}

export async function setTeam(group: Group, participantId: string, team: string | null) {
  if (group.status === "drawn") throw new AppError("Desfaça o sorteio antes de mudar as regras.");
  const target = await getParticipant(group, participantId);
  await sql`update participants set team = ${team} where id = ${target.id}`;
}

// Sorteio -------------------------------------------------------------------

async function drawInput(groupId: string) {
  const people = await sql<{ id: string; display_name: string; team: string | null }[]>`
    select id, display_name, team from participants where group_id = ${groupId} and status <> 'declined'`;
  const rules = await listExclusions(groupId);
  return {
    people,
    persons: people.map((p) => ({ id: p.id, team: p.team })),
    rules: rules.map((r) => ({ a: r.participant_a, b: r.participant_b, oneWay: r.one_way })),
  };
}

/** Problema do sorteio com nomes, para explicar ao organizador. */
export type NamedProblem =
  | { kind: "too-few"; min: number; count: number }
  | { kind: "giver-blocked" | "receiver-blocked"; people: string[] }
  | { kind: "bottleneck"; givers: string[]; receivers: string[] };

function nameProblem(problem: DrawProblem, people: { id: string; display_name: string }[]): NamedProblem {
  const name = (id: string) => people.find((p) => p.id === id)?.display_name ?? "?";
  switch (problem.kind) {
    case "too-few":
      return { ...problem, count: people.length };
    case "bottleneck":
      return { kind: "bottleneck", givers: problem.givers.map(name), receivers: problem.receivers.map(name) };
    default:
      return { kind: problem.kind, people: problem.people.map(name) };
  }
}

export async function checkGroupDraw(groupId: string): Promise<NamedProblem | null> {
  const { people, persons, rules } = await drawInput(groupId);
  const problem = checkDraw(persons, rules);
  return problem ? nameProblem(problem, people) : null;
}

export async function revealedCount(groupId: string) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from assignments where group_id = ${groupId} and seen_at is not null`;
  return n;
}

/**
 * Faz o sorteio. Se já houver sorteio e alguém já viu o resultado,
 * só refaz com force = true (o organizador confirmou que entende as consequências).
 */
export async function runDraw(group: Group, opts: { force?: boolean; rand?: RandInt } = {}) {
  return sql.begin(async (tx) => {
    await tx`select id from groups where id = ${group.id} for update`;
    const [{ seen }] = await tx<{ seen: number }[]>`
      select count(*)::int as seen from assignments where group_id = ${group.id} and seen_at is not null`;
    if (seen > 0 && !opts.force) {
      throw new AppError("Alguém já viu quem tirou. Para sortear de novo, confirme que entende que todos vão receber um resultado novo.");
    }
    const { people, persons, rules } = await drawInput(group.id);
    const res = drawPairs(persons, rules, opts.rand ?? secureRandInt);
    if (!res.ok) throw new DrawError(nameProblem(res.problem, people));

    await tx`delete from assignments where group_id = ${group.id}`;
    for (const p of res.pairs) {
      await tx`insert into assignments (group_id, giver_id, receiver_id) values (${group.id}, ${p.giver}, ${p.receiver})`;
    }
    await tx`update groups set status = 'drawn', drawn_at = now() where id = ${group.id}`;
    return { redraw: group.status === "drawn", count: res.pairs.length };
  });
}

export class DrawError extends AppError {
  constructor(public problem: NamedProblem) {
    super("Com essas regras não existe uma combinação possível.");
  }
}

/** Desfaz o sorteio e reabre o grupo. */
export async function resetDraw(group: Group) {
  await sql.begin(async (tx) => {
    await tx`delete from assignments where group_id = ${group.id}`;
    await tx`update groups set status = 'open', drawn_at = null where id = ${group.id}`;
  });
}

/** Todos os pares. Só se o organizador escolheu isso ao criar o grupo. */
export async function listAllPairs(group: Group) {
  if (!group.organizer_can_see_pairs) throw new AppError("Este grupo foi criado sem acesso do organizador aos pares.");
  return sql<{ giver: string; receiver: string }[]>`
    select g.display_name as giver, r.display_name as receiver from assignments a
    join participants g on g.id = a.giver_id join participants r on r.id = a.receiver_id
    where a.group_id = ${group.id} order by g.display_name`;
}

/** Quem deve receber o aviso do sorteio, com contato. */
export async function drawRecipients(groupId: string) {
  return sql<{ id: string; display_name: string; email: string | null; phone: string | null }[]>`
    select p.id, p.display_name, p.email, p.phone from participants p
    join assignments a on a.giver_id = p.id where p.group_id = ${groupId}`;
}

export async function deleteGroup(group: Group) {
  await sql`delete from groups where id = ${group.id}`;
}

// Recuperar links por e-mail -------------------------------------------------

export async function linksForEmail(email: string) {
  const admin = await sql<{ id: string; name: string }[]>`
    select id, name from groups where lower(organizer_email) = ${email} order by created_at desc limit 20`;
  const mine = await sql<{ id: string; name: string }[]>`
    select p.id, g.name from participants p join groups g on g.id = p.group_id
    where lower(p.email) = ${email} and p.status <> 'declined' order by g.created_at desc limit 20`;
  return {
    admin: await Promise.all(admin.map(async (g) => ({ name: g.name, token: await adminToken(g.id) }))),
    participant: await Promise.all(mine.map(async (p) => ({ name: p.name, token: await participantToken(p.id) }))),
  };
}

// Lembretes e limpeza ----------------------------------------------------------

export async function participantsWithEventOn(date: string) {
  return sql<{ id: string; group_name: string; display_name: string; email: string | null; phone: string | null }[]>`
    select p.id, g.name as group_name, p.display_name, p.email, p.phone
    from groups g join participants p on p.group_id = g.id
    join assignments a on a.giver_id = p.id
    where g.status = 'drawn' and g.event_date = ${date}`;
}

/** Apaga grupos 30 dias depois da festa (ou 1 ano depois de criados, se não tiverem data). */
export async function deleteExpiredGroups() {
  const rows = await sql`
    delete from groups
    where (event_date is not null and event_date < (now() at time zone 'America/Sao_Paulo')::date - 30)
       or (event_date is null and created_at < now() - interval '1 year')
    returning id`;
  return rows.length;
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
