import "server-only";
import crypto from "node:crypto";

/**
 * Tokens dos links individuais.
 * - hash (sha256) fica no banco para achar o dono do link;
 * - a versão cifrada (AES-256-GCM com APP_SECRET) deixa o servidor reenviar o mesmo link
 *   por e-mail/WhatsApp sem precisar mostrá-lo ao organizador.
 */

export const newToken = () => crypto.randomBytes(24).toString("base64url"); // 192 bits
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Código público do convite do grupo (não dá acesso a resultado nenhum). */
export const newInviteCode = () => crypto.randomBytes(9).toString("base64url");

/** Tokens válidos só têm letras, números, - e _. Evita consulta com lixo. */
export const looksLikeToken = (s: string) => /^[A-Za-z0-9_-]{16,64}$/.test(s);

function key() {
  const secret = process.env.APP_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("Defina APP_SECRET nas variáveis de ambiente.");
    return crypto.createHash("sha256").update("dev-apenas-local").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const [iv, tag, data] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Gera um token novo com o hash e a versão cifrada, prontos para salvar. */
export function issueToken() {
  const token = newToken();
  return { token, hash: hashToken(token), enc: encryptToken(token) };
}
