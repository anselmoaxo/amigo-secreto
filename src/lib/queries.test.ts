// Testes de integração com um Postgres de verdade.
// Rode com: TEST_DATABASE_URL=postgres://... npm test  (o banco é apagado e recriado)
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CleanGroup } from "./validation";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const baseGroup: CleanGroup = {
  name: "Família", occasion: "natal", organizerName: "Ana", organizerEmail: "ana@x.com", organizerPhone: "5511987654321",
  organizerJoins: true, eventDate: "2099-12-24", eventTime: "20:00", location: "Casa da vó", minValue: 50, maxValue: 100,
  description: null, rsvpDeadline: null, wishlistEnabled: true, wishlistUntil: null, allowChanges: true, organizerCanSeePairs: false,
};
const person = (name: string, extra: Partial<{ email: string; phone: string; team: string }> = {}) =>
  ({ name, email: extra.email ?? null, phone: extra.phone ?? null, team: extra.team ?? null });

d("grupo com links individuais", () => {
  let q: typeof import("./queries");
  let sql: typeof import("./db").sql;
  let admin = "";
  let anaToken = "";
  const tokens: Record<string, string> = {};

  const group = async () => (await q.getGroupByAdminToken(admin))!;
  const as = async (name: string) => (await q.getByAccessToken(tokens[name]))!;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("./db"));
    q = await import("./queries");
    await sql.unsafe("drop schema public cascade; create schema public;");
    const dir = path.join(process.cwd(), "db/migrations");
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await sql.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
    }
  });
  afterAll(async () => { await sql?.end(); });

  it("cria o grupo com organizador participante e pessoas convidadas", async () => {
    const res = await q.createGroup(baseGroup, [person("Bia", { email: "bia@x.com", team: "Casal 1" }), person("Caio", { team: "casal 1" })]);
    admin = res.adminToken;
    anaToken = res.myToken!;
    tokens.Ana = anaToken;
    const people = await q.listParticipants(res.groupId);
    expect(people.map((p) => [p.display_name, p.status])).toEqual([["Ana", "confirmed"], ["Bia", "pending"], ["Caio", "pending"]]);
    for (const p of people.filter((p) => !p.is_organizer)) tokens[p.display_name] = await q.participantToken(p.id);
    expect(tokens.Bia).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("nomes repetidos são recusados", async () => {
    await expect(q.createGroup(baseGroup, [person("ana")])).rejects.toThrow("duas vezes");
    await expect(q.addParticipant(await group(), person("BIA"))).rejects.toThrow("Já existe");
  });

  it("links inválidos não abrem nada", async () => {
    expect(await q.getGroupByAdminToken("x".repeat(32))).toBeNull();
    expect(await q.getByAccessToken(tokens.Bia.slice(0, -1) + "A")).toBeNull();
    expect(await q.getByAccessToken("' or 1=1 --")).toBeNull();
    // O link de participante não abre o painel e vice-versa.
    expect(await q.getGroupByAdminToken(tokens.Bia)).toBeNull();
    expect(await q.getByAccessToken(admin)).toBeNull();
  });

  it("entra pelo convite geral e confirma presença", async () => {
    const g = await group();
    tokens.Duda = await q.joinByInvite(g.invite_code, person("Duda", { email: "duda@x.com" }));
    expect((await as("Duda")).me.status).toBe("confirmed");
    await expect(q.joinByInvite(g.invite_code, person("duda"))).rejects.toThrow("esse nome");
    const bia = await as("Bia");
    await q.respond(bia.me, bia.group, "confirmed");
    expect((await as("Bia")).me.status).toBe("confirmed");
  });

  it("lista de desejos só da própria pessoa", async () => {
    const bia = await as("Bia");
    await q.addWish(bia.me, bia.group, "Livro", "https://loja.com/livro");
    const caio = await as("Caio");
    const [w] = await q.listWishes(bia.me.id);
    await q.deleteWish(caio.me, caio.group, w.id); // Caio não apaga o desejo da Bia
    expect(await q.listWishes(bia.me.id)).toHaveLength(1);
  });

  it("explica quando as regras impedem o sorteio", async () => {
    const g = await group();
    const people = await q.listParticipants(g.id);
    const id = (n: string) => people.find((p) => p.display_name === n)!.id;
    // Ana não pode tirar Duda; com Bia e Caio no mesmo núcleo, Ana fica só com Bia/Caio — ainda há solução.
    await q.addExclusion(g, id("Ana"), id("Duda"), true);
    expect(await q.checkGroupDraw(g.id)).toBeNull();
    await expect(q.addExclusion(g, id("Duda"), id("Ana"), false)).rejects.toThrow("Já existe");
    // Duda não pode tirar Bia nem Caio: só sobra Ana, mas Ana… dá. Bloqueando Ana também, Duda fica sem opção.
    await q.addExclusion(g, id("Duda"), id("Bia"), true);
    await q.addExclusion(g, id("Duda"), id("Caio"), true);
    await q.addExclusion(g, id("Ana"), id("Bia"), true);
    const problem = await q.checkGroupDraw(g.id);
    expect(problem).not.toBeNull();
    await expect(q.runDraw(g)).rejects.toBeInstanceOf(q.DrawError);
    for (const r of await q.listExclusions(g.id)) if (r.participant_a !== id("Ana") || r.participant_b !== id("Duda")) await q.deleteExclusion(g, r.id);
  });

  it("sorteia; cada pessoa vê só o seu par; o organizador não vê os pares", async () => {
    const g = await group();
    await q.runDraw(g);
    const names = await Promise.all(["Ana", "Bia", "Caio", "Duda"].map(async (n) => {
      const { me, group } = await as(n);
      return (await q.getMyMatch(me, group))!.name;
    }));
    expect(new Set(names).size).toBe(4);
    expect(names[0]).not.toBe("Duda"); // regra Ana -> Duda
    expect(names[1]).not.toBe("Caio"); // mesmo núcleo
    expect(names[2]).not.toBe("Bia");
    await expect(q.listAllPairs(await group())).rejects.toThrow("sem acesso");
  });

  it("depois do sorteio ninguém entra nem sai", async () => {
    const g = await group();
    await expect(q.joinByInvite(g.invite_code, person("Edu"))).rejects.toThrow("sorteio");
    const bia = (await q.listParticipants(g.id)).find((p) => p.display_name === "Bia")!;
    await expect(q.removeParticipant(g, bia.id)).rejects.toThrow("sorteio");
  });

  it("refazer só com confirmação depois que alguém viu", async () => {
    await q.runDraw(await group()); // ninguém viu: refaz direto
    const bia = await as("Bia");
    await q.markSeen(bia.me);
    expect(await q.revealedCount(bia.group.id)).toBe(1);
    await expect(q.runDraw(await group())).rejects.toThrow("Alguém já viu");
    await q.runDraw(await group(), { force: true });
    expect(await q.revealedCount(bia.group.id)).toBe(0);
  });

  it("trocar o link derruba o antigo", async () => {
    const g = await group();
    const old = tokens.Caio;
    const caio = (await as("Caio")).me;
    tokens.Caio = await q.regenerateParticipantToken(g, caio.id);
    expect(await q.getByAccessToken(old)).toBeNull();
    expect((await as("Caio")).me.id).toBe(caio.id);
  });

  it("recupera links pelo e-mail", async () => {
    const links = await q.linksForEmail("bia@x.com");
    expect(links.participant.map((l) => l.token)).toEqual([tokens.Bia]);
    const org = await q.linksForEmail("ana@x.com");
    expect(org.admin.map((l) => l.token)).toEqual([admin]);
  });

  it("organizador com acesso aos pares, quando escolhido na criação", async () => {
    const res = await q.createGroup({ ...baseGroup, name: "Firma", organizerCanSeePairs: true }, [person("X"), person("Y")]);
    const g = (await q.getGroupByAdminToken(res.adminToken))!;
    await q.runDraw(g);
    expect(await q.listAllPairs(g)).toHaveLength(3);
    // Desligar pode; religar não.
    await q.updateGroup(g, { ...baseGroup, name: "Firma", organizerCanSeePairs: false });
    const off = (await q.getGroupByAdminToken(res.adminToken))!;
    await q.updateGroup(off, { ...baseGroup, name: "Firma", organizerCanSeePairs: true });
    expect((await q.getGroupByAdminToken(res.adminToken))!.organizer_can_see_pairs).toBe(false);
  });

  it("encerrar apaga tudo", async () => {
    const g = await group();
    await q.deleteGroup(g);
    expect(await q.getGroupByAdminToken(admin)).toBeNull();
    expect(await q.getByAccessToken(tokens.Bia)).toBeNull();
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from wishes`;
    expect(n).toBe(0);
  });
});
