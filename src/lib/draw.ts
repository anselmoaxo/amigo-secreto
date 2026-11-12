export type Pair = { giver: string; receiver: string };

/**
 * Sorteia o amigo secreto como um único ciclo: embaralha a lista e cada
 * pessoa tira a próxima. Assim ninguém tira a si mesmo e não há trocas
 * diretas (A tira B e B tira A). Exclusões valem nos dois sentidos.
 * Retorna null se não achar combinação válida.
 */
export function drawPairs(
  ids: string[],
  exclusions: Array<[string, string]> = [],
  random: () => number = Math.random,
  maxTries = 2000,
): Pair[] | null {
  const unique = [...new Set(ids)];
  if (unique.length < 3) return null;

  const blocked = new Set<string>();
  for (const [a, b] of exclusions) {
    blocked.add(`${a}|${b}`);
    blocked.add(`${b}|${a}`);
  }

  for (let t = 0; t < maxTries; t++) {
    const order = shuffle(unique, random);
    const pairs = order.map((giver, i) => ({
      giver,
      receiver: order[(i + 1) % order.length],
    }));
    if (pairs.every((p) => !blocked.has(`${p.giver}|${p.receiver}`))) {
      return pairs;
    }
  }
  return null;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
