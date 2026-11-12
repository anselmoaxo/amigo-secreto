import crypto from "node:crypto";

/**
 * Sorteio do amigo secreto.
 *
 * Regras sempre valem: ninguém tira a si mesmo, cada pessoa tira exatamente uma
 * e é tirada exatamente uma vez. Além disso o organizador pode proibir combinações:
 * - pessoas do mesmo "núcleo" (casal, família, setor) não se tiram;
 * - regras entre duas pessoas, nos dois sentidos ou só num ("A não pode tirar B").
 *
 * Primeiro tentamos um ciclo único (A→B→C→...→A), que evita trocas diretas.
 * Se as regras não permitirem, aceitamos qualquer combinação válida.
 * Quando não existe combinação possível, devolvemos o motivo para explicar ao organizador.
 */

export type Person = { id: string; team?: string | null };
export type Rule = { a: string; b: string; oneWay?: boolean };
export type Pair = { giver: string; receiver: string };

export type DrawProblem =
  | { kind: "too-few"; min: number }
  /** Essas pessoas não podem tirar ninguém. */
  | { kind: "giver-blocked"; people: string[] }
  /** Ninguém pode tirar essas pessoas. */
  | { kind: "receiver-blocked"; people: string[] }
  /** Essas pessoas (givers) só podem tirar um grupo menor de pessoas (receivers). */
  | { kind: "bottleneck"; givers: string[]; receivers: string[] };

export type DrawResult = { ok: true; pairs: Pair[] } | { ok: false; problem: DrawProblem };

export const MIN_PEOPLE = 3;

/** Número aleatório seguro em [0, n). */
export type RandInt = (n: number) => number;
export const secureRandInt: RandInt = (n) => crypto.randomInt(n);

/** Mapa giver -> quem ele pode tirar. */
export function allowedMap(people: Person[], rules: Rule[] = []) {
  const blocked = new Set<string>();
  for (const r of rules) {
    blocked.add(`${r.a}|${r.b}`);
    if (!r.oneWay) blocked.add(`${r.b}|${r.a}`);
  }
  const team = new Map(people.map((p) => [p.id, p.team?.trim().toLowerCase() || null]));
  const map = new Map<string, string[]>();
  for (const g of people) {
    map.set(
      g.id,
      people
        .filter((r) => r.id !== g.id)
        .filter((r) => !(team.get(g.id) && team.get(g.id) === team.get(r.id)))
        .filter((r) => !blocked.has(`${g.id}|${r.id}`))
        .map((r) => r.id),
    );
  }
  return map;
}

/** Confere se dá para sortear, sem sortear. */
export function checkDraw(people: Person[], rules: Rule[] = []): DrawProblem | null {
  const res = analyse(people, rules);
  return res.ok ? null : res.problem;
}

export function drawPairs(people: Person[], rules: Rule[] = [], rand: RandInt = secureRandInt): DrawResult {
  const res = analyse(people, rules);
  if (!res.ok) return res;
  const { allowed, ids } = res;

  const cycle = findCycle(ids, allowed, rand);
  if (cycle) return { ok: true, pairs: cycle };

  // Sem ciclo único: pega uma combinação válida e embaralha com trocas que respeitam as regras.
  const match = maxMatching(shuffle(ids, rand), allowed, rand)!;
  const can = (g: string, r: string) => allowed.get(g)!.includes(r);
  for (let i = 0; i < ids.length * 60; i++) {
    const x = ids[rand(ids.length)];
    const y = ids[rand(ids.length)];
    if (x === y) continue;
    const rx = match.get(x)!;
    const ry = match.get(y)!;
    if (can(x, ry) && can(y, rx)) {
      match.set(x, ry);
      match.set(y, rx);
    }
  }
  return { ok: true, pairs: ids.map((giver) => ({ giver, receiver: match.get(giver)! })) };
}

// ----------------------------------------------------------------------------

function analyse(people: Person[], rules: Rule[]):
  | { ok: true; allowed: Map<string, string[]>; ids: string[] }
  | { ok: false; problem: DrawProblem } {
  const seen = new Set<string>();
  const unique = people.filter((p) => !seen.has(p.id) && seen.add(p.id));
  if (unique.length < MIN_PEOPLE) return { ok: false, problem: { kind: "too-few", min: MIN_PEOPLE } };

  const ids = unique.map((p) => p.id);
  const allowed = allowedMap(unique, rules);

  const noOption = ids.filter((id) => allowed.get(id)!.length === 0);
  if (noOption.length) return { ok: false, problem: { kind: "giver-blocked", people: noOption } };

  const reachable = new Set([...allowed.values()].flat());
  const unreachable = ids.filter((id) => !reachable.has(id));
  if (unreachable.length) return { ok: false, problem: { kind: "receiver-blocked", people: unreachable } };

  const match = maxMatching(ids, allowed);
  if (match) return { ok: true, allowed, ids };
  return { ok: false, problem: bottleneck(ids, allowed) };
}

/** Emparelhamento perfeito (algoritmo de Kuhn). null se não existir. */
function maxMatching(ids: string[], allowed: Map<string, string[]>, rand?: RandInt) {
  const owner = new Map<string, string>(); // receiver -> giver
  const options = (g: string) => (rand ? shuffle(allowed.get(g)!, rand) : allowed.get(g)!);

  const tryGiver = (g: string, visited: Set<string>): boolean => {
    for (const r of options(g)) {
      if (visited.has(r)) continue;
      visited.add(r);
      const current = owner.get(r);
      if (current === undefined || tryGiver(current, visited)) {
        owner.set(r, g);
        return true;
      }
    }
    return false;
  };

  for (const g of ids) if (!tryGiver(g, new Set())) return null;
  const match = new Map<string, string>();
  for (const [r, g] of owner) match.set(g, r);
  return match;
}

/**
 * Explica por que não há combinação: acha um grupo de pessoas que, juntas,
 * só podem tirar menos pessoas do que são (teorema de Hall).
 */
function bottleneck(ids: string[], allowed: Map<string, string[]>): DrawProblem {
  const owner = new Map<string, string>();
  const tryGiver = (g: string, visited: Set<string>): boolean => {
    for (const r of allowed.get(g)!) {
      if (visited.has(r)) continue;
      visited.add(r);
      const cur = owner.get(r);
      if (cur === undefined || tryGiver(cur, visited)) {
        owner.set(r, g);
        return true;
      }
    }
    return false;
  };
  let free: string | null = null;
  for (const g of ids) if (!tryGiver(g, new Set()) && free === null) free = g;

  // Busca alternada a partir de quem ficou sem par.
  const givers = new Set<string>([free!]);
  const receivers = new Set<string>();
  const queue = [free!];
  while (queue.length) {
    const g = queue.shift()!;
    for (const r of allowed.get(g)!) {
      if (receivers.has(r)) continue;
      receivers.add(r);
      const next = owner.get(r);
      if (next && !givers.has(next)) {
        givers.add(next);
        queue.push(next);
      }
    }
  }
  return { kind: "bottleneck", givers: [...givers], receivers: [...receivers] };
}

/** Ciclo único com busca aleatória limitada. */
function findCycle(ids: string[], allowed: Map<string, string[]>, rand: RandInt, budget = 40_000): Pair[] | null {
  const start = ids[rand(ids.length)];
  const path = [start];
  const used = new Set([start]);
  let steps = 0;

  const dfs = (): boolean => {
    if (++steps > budget) return false;
    const last = path[path.length - 1];
    if (path.length === ids.length) return allowed.get(last)!.includes(start);
    for (const next of shuffle(allowed.get(last)!, rand)) {
      if (used.has(next)) continue;
      path.push(next);
      used.add(next);
      if (dfs()) return true;
      path.pop();
      used.delete(next);
      if (steps > budget) return false;
    }
    return false;
  };

  if (!dfs()) return null;
  return path.map((giver, i) => ({ giver, receiver: path[(i + 1) % path.length] }));
}

function shuffle<T>(items: T[], rand: RandInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
