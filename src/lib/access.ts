import "server-only";
import * as q from "./queries";
import { enforce, hit, isLimited, LIMITS, RateLimitError } from "./ratelimit";
import { clientIp } from "./request";

/**
 * Autorização: cada ação resolve o grupo/participante a partir do token recebido, no servidor.
 * - token de administração → só o próprio grupo (painel do organizador);
 * - token de participante  → só a própria linha e o próprio par;
 * - código de convite      → só entrar no grupo (nunca painel nem resultados).
 * IDs (participante, regra, desejo) vindos do navegador sempre são conferidos contra o grupo do token.
 *
 * Tentativas com token inválido contam por IP. Com 192 bits de entropia, adivinhar é inviável;
 * o limite é defesa extra e reduz ruído de robôs.
 */

async function tokenAttempt<T>(lookup: () => Promise<T | null>, notFound: string): Promise<T> {
  const ip = await clientIp();
  const [max, win] = LIMITS.badTokenPerIp;
  if (await isLimited(["bad-token", ip], max)) throw new RateLimitError();
  const res = await lookup();
  if (!res) {
    await hit(["bad-token", ip], max, win);
    throw new q.AppError(notFound);
  }
  return res;
}

export const adminFromToken = (token: string) =>
  tokenAttempt(() => q.getGroupByAdminToken(String(token)), "Este link de organizador não funciona mais. Recupere seus links pelo e-mail.");

export const participantFromToken = (token: string) =>
  tokenAttempt(() => q.getByAccessToken(String(token)), "Este link não funciona mais. Peça um novo ao organizador.");

/** Limite por IP para criação, entrada e recuperação. */
export async function limitIp(kind: keyof typeof LIMITS, cost = 1) {
  const [max, win] = LIMITS[kind];
  await enforce([kind, await clientIp()], max, win, cost);
}

/** Limite por recurso (grupo, participante, convite). Não depende de IP: vale mesmo atrás de NAT/rede compartilhada. */
export async function limitResource(kind: keyof typeof LIMITS, id: string, cost = 1, message?: string) {
  const [max, win] = LIMITS[kind];
  await enforce([kind, id], max, win, cost, message);
}
