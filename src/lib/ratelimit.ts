import "server-only";
import crypto from "node:crypto";
import { sql } from "./db";
import { logError } from "./log";

/**
 * Limites de uso guardados no Postgres, então valem entre todas as instâncias do servidor
 * (na Vercel cada requisição pode cair numa instância diferente).
 *
 * Janela fixa: cada chave conta até `max` dentro de `windowSec` segundos.
 * A chave vai para o banco como HMAC: não guardamos IP nem e-mail em texto.
 */

export class RateLimitError extends Error {
  constructor(message = "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.") {
    super(message);
  }
}

function secret() {
  return process.env.APP_SECRET || process.env.CRON_SECRET || "rate-limit-dev";
}

export const limitKey = (...parts: string[]) =>
  crypto.createHmac("sha256", secret()).update(parts.join("|")).digest("base64url");

/**
 * Soma `cost` ao contador e diz se ainda está dentro do limite.
 * Atômico (um único upsert), então requisições simultâneas não passam juntas do limite.
 */
export async function hit(parts: string[], max: number, windowSec: number, cost = 1): Promise<boolean> {
  const key = limitKey(...parts);
  try {
    const [row] = await sql<{ count: number }[]>`
      insert into rate_limits as r (key, window_start, count, expires_at)
      values (${key}, now(), ${cost}, now() + make_interval(secs => ${windowSec}))
      on conflict (key) do update set
        count = case when r.expires_at <= now() then ${cost} else r.count + ${cost} end,
        window_start = case when r.expires_at <= now() then now() else r.window_start end,
        expires_at = case when r.expires_at <= now() then now() + make_interval(secs => ${windowSec}) else r.expires_at end
      returning count`;
    return row.count <= max;
  } catch (e) {
    // Tabela ainda não criada (deploy antes da migração): não derruba o site por causa do limite.
    if ((e as { code?: string })?.code === "42P01") return true;
    logError("rate limit", e);
    return true;
  }
}

/** Já passou do limite? Não soma nada. */
export async function isLimited(parts: string[], max: number): Promise<boolean> {
  try {
    const [row] = await sql<{ count: number }[]>`
      select count from rate_limits where key = ${limitKey(...parts)} and expires_at > now()`;
    return (row?.count ?? 0) >= max;
  } catch {
    return false;
  }
}

/** Soma e lança RateLimitError se passar do limite. */
export async function enforce(parts: string[], max: number, windowSec: number, cost = 1, message?: string) {
  if (!(await hit(parts, max, windowSec, cost))) throw new RateLimitError(message);
}

export async function purgeRateLimits() {
  try {
    const rows = await sql`delete from rate_limits where expires_at < now() - interval '1 day' returning 1`;
    return rows.length;
  } catch {
    return 0;
  }
}

/** Limites usados pelo app, num lugar só para revisar. [máximo, janela em segundos] */
export const LIMITS = {
  createPerIp: [10, 3600],
  /** Mensagens (e-mail/WhatsApp) disparadas a partir de um mesmo IP por dia. */
  messagesPerIp: [400, 86400],
  joinPerIp: [30, 3600],
  joinPerInvite: [120, 3600],
  recoverPerIp: [10, 3600],
  /** Quantos e-mails de recuperação um endereço recebe por hora (o resto é ignorado em silêncio). */
  recoverPerEmail: [3, 3600],
  resendPerParticipant: [5, 3600],
  linksPerGroup: [120, 3600],
  drawPerGroup: [10, 3600],
  badTokenPerIp: [30, 600],
} as const satisfies Record<string, readonly [number, number]>;
