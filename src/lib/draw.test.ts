import { describe, expect, it } from "vitest";
import { drawPairs } from "./draw";

const people = ["ana", "bia", "caio", "duda", "edu", "fabi"];

describe("drawPairs", () => {
  it("todo mundo dá e recebe exatamente um presente", () => {
    for (let n = 0; n < 200; n++) {
      const pairs = drawPairs(people)!;
      expect(pairs).toHaveLength(people.length);
      expect(new Set(pairs.map((p) => p.giver)).size).toBe(people.length);
      expect(new Set(pairs.map((p) => p.receiver)).size).toBe(people.length);
    }
  });

  it("ninguém tira a si mesmo", () => {
    for (let n = 0; n < 200; n++) {
      for (const p of drawPairs(people)!) expect(p.giver).not.toBe(p.receiver);
    }
  });

  it("respeita exclusões nos dois sentidos", () => {
    const ex: Array<[string, string]> = [["ana", "bia"], ["caio", "duda"]];
    for (let n = 0; n < 200; n++) {
      for (const p of drawPairs(people, ex)!) {
        const pair = [p.giver, p.receiver].sort().join("|");
        expect(["ana|bia", "caio|duda"]).not.toContain(pair);
      }
    }
  });

  it("exige pelo menos 3 pessoas", () => {
    expect(drawPairs(["ana", "bia"])).toBeNull();
  });

  it("retorna null quando as exclusões tornam impossível", () => {
    const ex: Array<[string, string]> = [["ana", "bia"], ["ana", "caio"]];
    expect(drawPairs(["ana", "bia", "caio"], ex)).toBeNull();
  });
});
