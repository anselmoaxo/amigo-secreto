import { describe, expect, it } from "vitest";
import { checkDraw, drawPairs, type Pair, type Person, type Rule } from "./draw";

const ids = ["ana", "bia", "caio", "duda", "edu", "fabi"];
const people: Person[] = ids.map((id) => ({ id }));

function valid(pairs: Pair[], n: number) {
  expect(pairs).toHaveLength(n);
  expect(new Set(pairs.map((p) => p.giver)).size).toBe(n);
  expect(new Set(pairs.map((p) => p.receiver)).size).toBe(n);
  for (const p of pairs) expect(p.giver).not.toBe(p.receiver);
}

function draw(ps: Person[], rules: Rule[] = []) {
  const r = drawPairs(ps, rules);
  if (!r.ok) throw new Error(`sem solução: ${r.problem.kind}`);
  return r.pairs;
}

describe("drawPairs", () => {
  it("todo mundo dá e recebe exatamente um presente, ninguém tira a si mesmo", () => {
    for (let n = 0; n < 200; n++) valid(draw(people), ids.length);
  });

  it("respeita regras nos dois sentidos", () => {
    const rules: Rule[] = [{ a: "ana", b: "bia" }, { a: "caio", b: "duda" }];
    for (let n = 0; n < 200; n++) {
      for (const p of draw(people, rules)) {
        expect(["ana|bia", "caio|duda"]).not.toContain([p.giver, p.receiver].sort().join("|"));
      }
    }
  });

  it("regra de um sentido só bloqueia aquele sentido", () => {
    const rules: Rule[] = [{ a: "ana", b: "bia", oneWay: true }];
    let biaTirouAna = false;
    for (let n = 0; n < 300; n++) {
      const pairs = draw(people, rules);
      expect(pairs.find((p) => p.giver === "ana")!.receiver).not.toBe("bia");
      if (pairs.find((p) => p.giver === "bia")!.receiver === "ana") biaTirouAna = true;
    }
    expect(biaTirouAna).toBe(true);
  });

  it("pessoas do mesmo núcleo não se tiram (sem diferença de maiúsculas)", () => {
    const ps: Person[] = [
      { id: "ana", team: "Silva" }, { id: "bia", team: "silva " }, { id: "caio", team: "Souza" },
      { id: "duda", team: "Souza" }, { id: "edu" }, { id: "fabi" },
    ];
    for (let n = 0; n < 200; n++) {
      for (const p of draw(ps)) {
        expect(["ana|bia", "caio|duda"]).not.toContain([p.giver, p.receiver].sort().join("|"));
      }
    }
  });

  it("acha uma combinação quando o ciclo único é impossível", () => {
    // Dois casais em núcleos + uma pessoa: ainda há solução.
    const ps: Person[] = [{ id: "a", team: "x" }, { id: "b", team: "x" }, { id: "c", team: "y" }, { id: "d", team: "y" }];
    for (let n = 0; n < 50; n++) valid(draw(ps), 4);
  });

  it("varia o resultado", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 100; n++) seen.add(draw(people).map((p) => p.receiver).join(","));
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("checkDraw explica o problema", () => {
  it("exige pelo menos 3 pessoas", () => {
    expect(checkDraw([{ id: "a" }, { id: "b" }])).toEqual({ kind: "too-few", min: 3 });
  });

  it("aponta quem não pode tirar ninguém", () => {
    const rules: Rule[] = [{ a: "ana", b: "bia" }, { a: "ana", b: "caio" }];
    expect(checkDraw([{ id: "ana" }, { id: "bia" }, { id: "caio" }], rules)).toEqual({ kind: "giver-blocked", people: ["ana"] });
  });

  it("aponta quem ninguém pode tirar", () => {
    const rules: Rule[] = [{ a: "bia", b: "ana", oneWay: true }, { a: "caio", b: "ana", oneWay: true }];
    expect(checkDraw([{ id: "ana" }, { id: "bia" }, { id: "caio" }], rules)).toEqual({ kind: "receiver-blocked", people: ["ana"] });
  });

  it("aponta o gargalo quando muita gente só pode tirar poucas pessoas", () => {
    // Família de 3 num grupo de 5: os 3 só podem tirar 2 pessoas.
    const ps: Person[] = [
      { id: "a", team: "f" }, { id: "b", team: "f" }, { id: "c", team: "f" }, { id: "d" }, { id: "e" },
    ];
    const problem = checkDraw(ps);
    expect(problem?.kind).toBe("bottleneck");
    if (problem?.kind === "bottleneck") {
      expect(problem.givers.length).toBeGreaterThan(problem.receivers.length);
      expect(problem.receivers.sort()).toEqual(["d", "e"]);
    }
  });

  it("não acusa problema quando há solução", () => {
    expect(checkDraw(people, [{ a: "ana", b: "bia" }])).toBeNull();
  });
});
