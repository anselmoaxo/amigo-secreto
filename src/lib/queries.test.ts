// Testes de integração com um Postgres de verdade.
// Rode com: TEST_DATABASE_URL=postgres://... npm test  (o banco é apagado e recriado)
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("regras de acesso no banco", () => {
  let q: typeof import("./queries");
  let sql: typeof import("./db").sql;
  const users: Record<string, string> = {};
  let groupId = "";
  let code = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("./db"));
    q = await import("./queries");
    await sql.unsafe("drop schema public cascade; create schema public;");
    await sql.unsafe(fs.readFileSync(path.join(process.cwd(), "db/migrations/0001_init.sql"), "utf8"));
    for (const n of ["ana", "bia", "caio", "duda", "intruso"]) {
      const [u] = await sql<{ id: string }[]>`insert into users (email) values (${n + "@x.com"}) returning id`;
      users[n] = u.id;
    }
  });
  afterAll(async () => { await sql?.end(); });

  it("cria grupo e convida", async () => {
    groupId = await q.createGroup(users.ana, { name: "Família", displayName: "Ana", eventDate: "2026-12-24", location: null, min: 50, max: 100 });
    const g = await q.getGroupForMember(groupId, users.ana);
    code = g!.invite_code;
    expect(await q.joinGroup(code, users.bia, "Bia")).toBe(groupId);
    await q.joinGroup(code, users.caio, "Caio");
    await q.joinGroup(code, users.caio, "Caio de novo"); // entrar duas vezes não duplica
    expect(await q.listParticipants(groupId)).toHaveLength(3);
  });

  it("quem não é membro não vê o grupo", async () => {
    expect(await q.getGroupForMember(groupId, users.intruso)).toBeNull();
    await expect(q.addWish(groupId, users.intruso, "hack", null)).rejects.toThrow(q.AppError);
  });

  it("só o organizador mexe nas regras e no sorteio", async () => {
    const people = await q.listParticipants(groupId);
    const [ana, bia] = people;
    await expect(q.addExclusion(groupId, users.bia, ana.id, bia.id)).rejects.toThrow("organizador");
    await expect(q.listExclusions(groupId, users.bia)).rejects.toThrow("organizador");
    await expect(q.runDraw(groupId, users.bia)).rejects.toThrow("organizador");
    await expect(q.removeParticipant(groupId, users.bia, ana.id)).rejects.toThrow();
  });

  it("não deixa apagar o desejo de outra pessoa", async () => {
    await q.addWish(groupId, users.bia, "Livro", null);
    const bia = (await q.listParticipants(groupId)).find((p) => p.user_id === users.bia)!;
    const [w] = await q.listWishes(bia.id);
    await q.deleteWish(w.id, users.caio);
    expect(await q.listWishes(bia.id)).toHaveLength(1);
  });

  it("sorteia respeitando exclusões e cada um vê só o seu par", async () => {
    await q.joinGroup(code, users.duda, "Duda");
    const people = await q.listParticipants(groupId);
    const id = (n: string) => people.find((p) => p.display_name === n)!.id;
    await q.addExclusion(groupId, users.ana, id("Ana"), id("Bia"));

    const { people: notified } = await q.runDraw(groupId, users.ana);
    expect(notified.map((p) => p.email).sort()).toEqual(["ana@x.com", "bia@x.com", "caio@x.com", "duda@x.com"]);

    const matches = await Promise.all(["ana", "bia", "caio", "duda"].map((u) => q.getMyMatch(groupId, users[u])));
    const names = matches.map((m) => m!.name);
    expect(new Set(names).size).toBe(4);
    expect(names[0]).not.toBe("Bia"); // Ana não tira Bia
    expect(names[1]).not.toBe("Ana"); // nem Bia tira Ana
    expect(await q.getMyMatch(groupId, users.intruso)).toBeNull();
  });

  it("depois do sorteio ninguém entra nem sai", async () => {
    await expect(q.joinGroup(code, users.intruso, "Intruso")).rejects.toThrow("sorteio");
    const bia = (await q.listParticipants(groupId)).find((p) => p.user_id === users.bia)!;
    await expect(q.removeParticipant(groupId, users.ana, bia.id)).rejects.toThrow("sorteio");
  });

  it("reabrir apaga o sorteio", async () => {
    await q.reopenGroup(groupId, users.ana);
    expect(await q.getMyMatch(groupId, users.ana)).toBeNull();
    expect((await q.getGroupForMember(groupId, users.ana))!.status).toBe("open");
  });
});
