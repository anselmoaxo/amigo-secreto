/**
 * Logs sem segredos: tira tokens de links, e-mails e telefones antes de escrever,
 * e nunca imprime o objeto de erro inteiro (erros do Postgres trazem a consulta e os parâmetros).
 */

const TOKEN_PATH = /(\/(?:p|o)\/)[A-Za-z0-9_-]{16,}/g;
const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;
const PHONE = /\b\d{10,13}\b/g;

export function redact(s: string) {
  return s.replace(TOKEN_PATH, "$1[token]").replace(EMAIL, "[e-mail]").replace(PHONE, "[telefone]");
}

export function logError(context: string, e: unknown) {
  const err = e as { name?: string; message?: string; code?: string } | null;
  const parts = [err?.name, err?.code, err?.message].filter(Boolean).map((p) => redact(String(p)).slice(0, 300));
  console.error(`[${context}]`, parts.join(" · ") || "erro desconhecido");
}

/** Só em desenvolvimento: mostra no terminal o que seria enviado (inclusive links, para testar). */
export function devLog(message: string) {
  if (process.env.NODE_ENV !== "production") console.log(message);
  else console.log(redact(message));
}
