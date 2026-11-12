// Testes de segurança com grupos e pessoas fictícias, chamando as ações do servidor diretamente
// (como faria alguém usando a API sem o site). Precisa de um Postgres de teste:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/amigo_test npm test
// O banco de teste é apagado e recriado. Nunca aponte para o banco de produção.
import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertValidPairs } from "./draw";
import { redact } from "./log";
import { normalizeIp } from "./request";
import type { CleanGroup } from "./validation";

// --- Next.js fora do Next: cabeçalhos, cookies, cache e after() ---------------
const jar = new Map<string, string>();
const pending: Promise<unknown>[] = [];
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT" }); } }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => void pending.push(Promise.resolve().then(fn)),
}));

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const baseGroup: CleanGroup = {
  name: "Grupo A", occasion: "amigos", organizerName: "Olga", organizerEmail: "olga@exemplo.test", organizerPhone: null,
  organizerJoins: false, eventDate: "2099-12-24", eventTime: null, location: null, minValue: null, maxValue: null,
  description: null, rsvpDeadline: null, wishlistEnabled: true, wishlistUntil: null, allowChanges: true, organizerCanSeePairs: false,
};
const person = (name: string, email: string | null = null) => ({ name, email, phone: null, team: null });
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

// --- Unidades sem banco ----------------------------------------------------------

describe("utilitários de segurança", () => {
  it("logs não levam token, e-mail nem telefone", () => {
    const line = redact("para 5511987654321: abra https://x.com/p/AbCdEfGhIjKlMnOpQrStUvWx12 ou /o/ZZZZZZZZZZZZZZZZZZZZ (ana@x.com)");
    expect(line).not.toMatch(/AbCdEfGh|ZZZZZZZZ|ana@x\.com|5511987654321/);
    expect(line).toContain("/p/[token]");
  });

  it("IPv6 conta por bloco /64; IPv4 como está", () => {
    expect(normalizeIp("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("2001:db8:1:2:bbbb::9")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("::ffff:198.51.100.7")).toBe("198.51.100.7");
  });

  it("confere o sorteio antes de gravar", () => {
    const people = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(() => assertValidPairs(people, [], [{ giver: "a", receiver: "b" }, { giver: "b", receiver: "c" }, { giver: "c", receiver: "a" }])).not.toThrow();
    expect(() => assertValidPairs(people, [], [{ giver: "a", receiver: "a" }, { giver: "b", receiver: "c" }, { giver: "c", receiver: "b" }])).toThrow("a si mesmo");
    expect(() => assertValidPairs(people, [], [{ giver: "a", receiver: "b" }, { giver: "b", receiver: "a" }])).toThrow("de fora");
    expect(() => assertValidPairs(people, [{ a: "a", b: "b", oneWay: true }], [{ giver: "a", receiver: "b" }, { giver: "b", receiver: "c" }, { giver: "c", receiver: "a" }])).toThrow("regra");
  });

  it("páginas privadas saem com no-store e cabeçalhos de proteção", async () => {
    const { default: config } = await import("../../next.config");
    const rules = await config.headers!();
    for (const p of ["/p/:path*", "/o/:path*", "/g/:path*", "/recuperar"]) {
      const r = rules.find((x) => x.source === p)!;
      expect(r.headers.find((h) => h.key === "Cache-Control")?.value).toContain("no-store");
    }
    const all = rules.find((x) => x.source === "/:path*")!.headers.map((h) => h.key);
    expect(all).toEqual(expect.arrayContaining(["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]));
  });
});

// --- Integração com Postgres ---------------------------------------------------

d("autorização, sigilo e integridade (API direta)", () => {
  let q: typeof import("./queries");
  let sql: typeof import("./db").sql;
  let org: typeof import("@/app/actions/organizer");
  let part: typeof import("@/app/actions/participant");
  let rec: typeof import("@/app/actions/recover");
  let logs: string[] = [];

  // Grupo A (Olga organiza: Ana, Bruno, Carla, Davi) e grupo B (Xavier organiza: Yara, Zeca, Wil)
  const A = { admin: "", id: "", tokens: {} as Record<string, string>, ids: {} as Record<string, string> };
  const B = { admin: "", id: "", tokens: {} as Record<string, string>, ids: {} as Record<string, string> };

  async function setup(target: typeof A, g: CleanGroup, names: string[]) {
    const res = await q.createGroup(g, names.map((n) => person(n, `${n.toLowerCase()}@exemplo.test`)));
    target.admin = res.adminToken;
    target.id = res.groupId;
    for (const p of await q.listParticipants(res.groupId)) {
      target.ids[p.display_name] = p.id;
      target.tokens[p.display_name] = await q.participantToken(p.id);
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.APP_SECRET = "segredo-de-teste-nao-usar";
    delete process.env.RESEND_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    ({ sql } = await import("./db"));
    q = await import("./queries");
    await sql.unsafe("drop schema public cascade; create schema public;");
    const dir = path.join(process.cwd(), "db/migrations");
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await sql.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
    }
    org = await import("@/app/actions/organizer");
    part = await import("@/app/actions/participant");
    rec = await import("@/app/actions/recover");
    await setup(A, baseGroup, ["Ana", "Bruno", "Carla", "Davi"]);
    await setup(B, { ...baseGroup, name: "Grupo B", organizerName: "Xavier", organizerEmail: "xavier@exemplo.test" }, ["Yara", "Zeca", "Wil"]);
  });

  beforeEach(async () => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a) => void logs.push(a.join(" ")));
    vi.spyOn(console, "error").mockImplementation((...a) => void logs.push(a.join(" ")));
    await sql`truncate rate_limits`;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await sql?.end(); });

  const draw = (admin: string, extra: Record<string, string> = {}) => org.drawAction({}, form({ t: admin, ...extra }));

  // 1. Um participante não acessa outro participante ou grupo -----------------------

  it("1. participante só enxerga a si mesmo; IDs de outro grupo são recusados", async () => {
    const ana = (await q.getByAccessToken(A.tokens.Ana))!;
    expect(ana.me.display_name).toBe("Ana");
    expect(ana.group.id).toBe(A.id);

    // Bruno cria um desejo; Ana tenta apagá-lo mandando o id dele.
    expect((await part.addWishAction({}, form({ t: A.tokens.Bruno, description: "Livro" }))).ok).toBe(true);
    const [wish] = await q.listWishes(A.ids.Bruno);
    expect((await part.deleteWishAction({}, form({ t: A.tokens.Ana, id: wish.id }))).ok).toBe(true); // resposta neutra…
    expect(await q.listWishes(A.ids.Bruno)).toHaveLength(1); // …mas nada foi apagado

    // Organizador do grupo A tentando mexer em gente do grupo B
    const r1 = await org.removePersonAction({}, form({ t: A.admin, id: B.ids.Yara }));
    expect(r1.ok).toBe(false);
    const r2 = await org.personalLinkAction(A.admin, B.ids.Yara);
    expect(r2.ok).toBe(false);
    const r3 = await org.addRuleAction({}, form({ t: A.admin, a: A.ids.Ana, b: B.ids.Yara }));
    expect(r3.ok).toBe(false);
    const r4 = await org.editPersonAction({}, form({ t: A.admin, id: B.ids.Zeca, name: "Hackeado" }));
    expect(r4.ok).toBe(false);
    expect((await q.listParticipants(B.id)).map((p) => p.display_name)).toContain("Zeca");
    expect(await q.listParticipants(B.id)).toHaveLength(3);
  });

  // 2. Convite comum não concede acesso ao painel -----------------------------------

  it("2. código de convite e link de participante não abrem o painel nem resultados", async () => {
    const [{ invite_code }] = await sql<{ invite_code: string }[]>`select invite_code from groups where id = ${A.id}`;
    for (const fake of [invite_code, A.tokens.Ana]) {
      expect(await q.getGroupByAdminToken(fake)).toBeNull();
      expect((await org.pairsAction(fake)).ok).toBe(false);
      expect((await draw(fake)).ok).toBe(false);
      expect((await org.removePersonAction({}, form({ t: fake, id: A.ids.Bruno }))).ok).toBe(false);
    }
    expect((await part.revealAction(invite_code)).ok).toBe(false);
    // O convite só mostra dados do evento, nunca participantes ou pares
    const inv = (await q.getInvite(invite_code))!;
    expect(Object.keys(inv)).not.toEqual(expect.arrayContaining(["pairs", "assignments", "admin_token_hash"]));
  });

  // 3. Resultados privados não aparecem em respostas nem logs ------------------------

  it("3. resultado só para o próprio participante; nada de pares em respostas ou logs", async () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production"; // logs como em produção
    let res;
    try {
      res = await draw(A.admin);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
    expect(res.ok).toBe(true);
    expect(JSON.stringify(res)).not.toMatch(/Ana|Bruno|Carla|Davi/); // resposta do organizador não traz nomes do par

    const pairs = await sql<{ giver: string; receiver: string }[]>`
      select g.display_name as giver, r.display_name as receiver from assignments a
      join participants g on g.id = a.giver_id join participants r on r.id = a.receiver_id where a.group_id = ${A.id}`;
    expect(pairs).toHaveLength(4);

    // Pares não podem ser pedidos pelo organizador quando o grupo não permite
    expect((await org.pairsAction(A.admin)).ok).toBe(false);

    // Ana recebe só o próprio par, com os campos mínimos
    const r = await part.revealAction(A.tokens.Ana);
    if (!r.ok) throw new Error(r.error);
    expect(Object.keys(r).sort()).toEqual(["firstSeenAt", "name", "ok", "otherDevice", "preferences", "wishes"]);
    expect(r.name).toBe(pairs.find((p) => p.giver === "Ana")!.receiver);
    expect(JSON.stringify(r)).not.toContain('"giver"');

    // Painel do organizador: nenhum campo com o par de alguém
    const list = await q.listParticipants(A.id);
    expect(JSON.stringify(list)).not.toMatch(/receiver|giver|assignment/);

    // Logs do envio (sem chaves de e-mail/WhatsApp, em modo produção): sem tokens nem e-mails
    const all = logs.join("\n");
    for (const t of [A.admin, ...Object.values(A.tokens)]) expect(all).not.toContain(t);
    expect(all).not.toMatch(/@exemplo\.test/);
  });

  it("3b. aviso quando o papelzinho foi aberto antes em outro aparelho", async () => {
    jar.clear();
    const first = await part.revealAction(A.tokens.Bruno); // aparelho 1
    expect(first.ok && first.otherDevice).toBe(false);
    const again = await part.revealAction(A.tokens.Bruno); // mesmo aparelho
    expect(again.ok && again.otherDevice).toBe(false);
    jar.clear(); // aparelho 2 (por exemplo, o de quem repassou o link)
    const other = await part.revealAction(A.tokens.Bruno);
    expect(other.ok && other.otherDevice).toBe(true);
  });

  // 4. Tokens inválidos ou revogados -----------------------------------------------

  it("4. tokens inválidos, trocados ou de grupo apagado são recusados", async () => {
    const old = A.tokens.Carla;
    const regen = await org.personalLinkAction(A.admin, A.ids.Carla, true);
    expect(regen.ok).toBe(true);
    expect((await part.revealAction(old)).ok).toBe(false);
    expect(await q.getByAccessToken(old)).toBeNull();
    A.tokens.Carla = regen.ok ? regen.url.split("/p/")[1] : "";
    expect((await part.revealAction(A.tokens.Carla)).ok).toBe(true);

    for (const bad of ["", "x", "' or 1=1 --", "A".repeat(32), `${A.admin}x`, "../o/" + A.admin]) {
      expect((await part.revealAction(bad)).ok).toBe(false);
      expect((await org.pairsAction(bad)).ok).toBe(false);
    }
  });

  it("4b. muitas tentativas com token errado bloqueiam a origem por um tempo", async () => {
    process.env.TRUST_PROXY = "1";
    try {
      for (let i = 0; i < 30; i++) await part.revealAction(`token-errado-${i}-xxxxxxxxxxxxxxxx`);
      const blocked = await part.revealAction(A.tokens.Ana);
      expect(blocked.ok).toBe(false);
      expect(!blocked.ok && blocked.error).toMatch(/Muitas tentativas/);
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });

  // 5. Recuperação não revela cadastros e tem limites -------------------------------

  it("5. recuperação responde igual para e-mail cadastrado e não cadastrado, com limite por endereço e por origem", async () => {
    const known = await rec.recoverAction({}, form({ email: "ana@exemplo.test" }));
    const unknown = await rec.recoverAction({}, form({ email: "ninguem@exemplo.test" }));
    await Promise.all(pending.splice(0));
    const strip = (s: typeof known) => ({ ...s, at: 0, message: s.message?.replace(/\S+@\S+/, "") });
    expect(strip(known)).toEqual(strip(unknown));

    // Só 3 e-mails de recuperação por hora para o mesmo endereço
    logs = [];
    for (let i = 0; i < 5; i++) await rec.recoverAction({}, form({ email: "bruno@exemplo.test" }));
    await Promise.all(pending.splice(0));
    expect(logs.filter((l) => l.includes("[e-mail desativado]") && l.includes("bruno@")).length).toBe(3);

    // Por origem: depois de 10 pedidos na hora, recusa (com a mesma mensagem para qualquer e-mail)
    process.env.TRUST_PROXY = "1";
    try {
      await sql`truncate rate_limits`;
      for (let i = 0; i < 10; i++) expect((await rec.recoverAction({}, form({ email: `x${i}@exemplo.test` }))).ok).toBe(true);
      const a = await rec.recoverAction({}, form({ email: "ana@exemplo.test" }));
      const b = await rec.recoverAction({}, form({ email: "nao-existe@exemplo.test" }));
      expect(a.ok).toBe(false);
      expect(a.error).toBe(b.error);
    } finally {
      delete process.env.TRUST_PROXY;
      await Promise.all(pending.splice(0));
    }
  });

  it("5b. criar grupos e disparar convites tem limite por origem", async () => {
    process.env.TRUST_PROXY = "1";
    const { createGroupAction } = await import("@/app/actions/create");
    const group = { name: "Spam", occasion: "amigos", organizerName: "S", organizerEmail: "", organizerPhone: "(11) 98765-4321", organizerJoins: true,
      eventDate: "", eventTime: "", location: "", minValue: "", maxValue: "", description: "", rsvpDeadline: "",
      wishlistEnabled: true, wishlistUntil: "", allowChanges: true, organizerCanSeePairs: false };
    try {
      let ok = 0;
      for (let i = 0; i < 12; i++) if ((await createGroupAction({ group, people: [], sendInvites: false })).ok) ok++;
      expect(ok).toBe(10);
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });

  // 6. Requisições simultâneas não duplicam nem alteram o sorteio -----------------------

  it("6. vários pedidos de sorteio ao mesmo tempo geram um único resultado", async () => {
    const before = await sql`select giver_id, receiver_id from assignments where group_id = ${B.id}`;
    expect(before).toHaveLength(0);
    const results = await Promise.all(Array.from({ length: 6 }, () => draw(B.admin)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => /já foi feito/.test(r.error ?? ""))).toBe(true);
    const snap = await sql`select giver_id, receiver_id from assignments where group_id = ${B.id} order by giver_id`;
    expect(snap).toHaveLength(3);

    // Pedido repetido (mesmo formulário de "Fazer o sorteio") não muda o resultado
    expect((await draw(B.admin)).ok).toBe(false);
    expect(await sql`select giver_id, receiver_id from assignments where group_id = ${B.id} order by giver_id`).toEqual(snap);
  });

  it("6b. sorteio e remoção/desistência simultâneos deixam o grupo consistente", async () => {
    // Grupo C aberto, com 6 pessoas
    const res = await q.createGroup({ ...baseGroup, name: "Grupo C" }, ["P1", "P2", "P3", "P4", "P5", "P6"].map((n) => person(n)));
    const people = await q.listParticipants(res.groupId);
    const g = (await q.getGroupByAdminToken(res.adminToken))!;
    const p6token = await q.participantToken(people[5].id);
    await Promise.allSettled([
      draw(res.adminToken),
      org.removePersonAction({}, form({ t: res.adminToken, id: people[4].id })),
      part.respondAction({}, form({ t: p6token, answer: "declined" })),
      q.joinByInvite(g.invite_code, person("P7")),
    ]);
    // Seja qual for a ordem, todo participante ativo de um grupo sorteado dá e recebe exatamente uma vez
    const [{ status }] = await sql<{ status: string }[]>`select status from groups where id = ${res.groupId}`;
    expect(status).toBe("drawn");
    const rows = await sql<{ id: string; gives: number; gets: number }[]>`
      select p.id,
        (select count(*)::int from assignments a where a.giver_id = p.id) as gives,
        (select count(*)::int from assignments a where a.receiver_id = p.id) as gets
      from participants p where p.group_id = ${res.groupId} and p.status <> 'declined'`;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) expect([r.gives, r.gets]).toEqual([1, 1]);
  });

  it("6c. o banco recusa mudanças de participantes num grupo sorteado, mesmo fora do app", async () => {
    await expect(sql`delete from participants where id = ${A.ids.Davi}`).rejects.toThrow("sorteado");
    await expect(sql`update participants set status = 'declined' where id = ${A.ids.Davi}`).rejects.toThrow("sorteado");
    await expect(sql`insert into participants (group_id, display_name) values (${A.id}, 'Intruso')`).rejects.toThrow("sorteado");
    await expect(sql`insert into assignments (group_id, giver_id, receiver_id) values (${A.id}, ${A.ids.Ana}, ${B.ids.Yara})`).rejects.toThrow();
    await expect(sql`update assignments set receiver_id = giver_id where giver_id = ${A.ids.Ana}`).rejects.toThrow();
    // Apagar o grupo inteiro continua funcionando (cascade)
    const tmp = await q.createGroup({ ...baseGroup, name: "Temp" }, ["T1", "T2", "T3"].map((n) => person(n)));
    await q.runDraw((await q.getGroupByAdminToken(tmp.adminToken))!);
    await q.deleteGroup((await q.getGroupByAdminToken(tmp.adminToken))!);
    expect(await sql`select 1 from participants where group_id = ${tmp.groupId}`).toHaveLength(0);
  });

  // 7. Regras valem pela API direta ---------------------------------------------------

  it("7. regras do grupo valem mesmo chamando a API sem o site", async () => {
    // Ver pares não pode ser ligado depois da criação
    expect((await org.updateGroupAction(A.admin, { ...emptyInput(), organizerCanSeePairs: true })).ok).toBe(true);
    expect((await q.getGroupByAdminToken(A.admin))!.organizer_can_see_pairs).toBe(false);
    expect((await org.pairsAction(A.admin)).ok).toBe(false);

    // Grupo sorteado: participante não desiste, organizador não remove, ninguém entra
    expect((await part.respondAction({}, form({ t: A.tokens.Davi, answer: "declined" }))).ok).toBe(false);
    expect((await org.removePersonAction({}, form({ t: A.admin, id: A.ids.Davi }))).ok).toBe(false);
    expect((await org.addRuleAction({}, form({ t: A.admin, a: A.ids.Ana, b: A.ids.Bruno }))).ok).toBe(false);

    // Link de desejo: só http(s), sem usuário/senha embutidos
    const open = await q.createGroup({ ...baseGroup, name: "Desejos" }, [person("L1")]);
    const l1 = await q.participantToken((await q.listParticipants(open.groupId))[0].id);
    for (const link of ["javascript:alert(1)", "data:text/html,oi", "https://usuario:senha@loja.test/x", "http://localhost"]) {
      const r = await part.addWishAction({}, form({ t: l1, description: "x", link }));
      expect(r.ok).toBe(false);
    }
    expect((await part.addWishAction({}, form({ t: l1, description: "x", link: "loja.test/produto?id=1" }))).ok).toBe(true);
    expect((await q.listWishes((await q.getByAccessToken(l1))!.me.id))[0].link).toBe("https://loja.test/produto?id=1");

    // Muitos sorteios seguidos no mesmo grupo são limitados (cada um dispara mensagens)
    const many = await q.createGroup({ ...baseGroup, name: "Muitos" }, ["M1", "M2", "M3"].map((n) => person(n)));
    expect((await draw(many.adminToken)).ok).toBe(true);
    let ok = 0;
    for (let i = 0; i < 12; i++) if ((await draw(many.adminToken, { mode: "redraw" })).ok) ok++;
    expect(ok).toBe(9); // 10 por hora no total
  });

  function emptyInput() {
    return { name: "Grupo A", occasion: "amigos", organizerName: "Olga", organizerEmail: "olga@exemplo.test", organizerPhone: "",
      organizerJoins: false, eventDate: "2099-12-24", eventTime: "", location: "", minValue: "", maxValue: "", description: "",
      rsvpDeadline: "", wishlistEnabled: true, wishlistUntil: "", allowChanges: true, organizerCanSeePairs: false };
  }
});
