import { AppError } from "@/lib/queries";
import { RateLimitError } from "@/lib/ratelimit";
import { logError } from "@/lib/log";
import type { Errors } from "@/lib/validation";

/** Resposta padrão das ações de formulário. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Errors;
  /** Muda a cada envio, para o formulário saber que pode limpar os campos. */
  at?: number;
};

export const done = (message?: string): ActionState => ({ ok: true, message, at: Date.now() });
export const failed = (error: string, fieldErrors?: Errors): ActionState => ({ ok: false, error, fieldErrors, at: Date.now() });

export const text = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

/** Erros esperados viram mensagem; inesperados são registrados e viram mensagem genérica. */
export async function guard(fn: () => Promise<ActionState>, fallback = "Algo deu errado do nosso lado. Tente de novo em instantes."): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    const known = knownError(e);
    if (known) return failed(known);
    // redirect() e notFound() do Next usam exceções: deixamos passar.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    logError("ação", e);
    return failed(fallback);
  }
}

/**
 * Mensagem para erros esperados (regra do app, limite de uso, trava do banco).
 * null para o resto, que vira mensagem genérica: nada de SQL, stack trace ou dado interno na resposta.
 */
export function knownError(e: unknown): string | null {
  if (e instanceof AppError || e instanceof RateLimitError) return e.message;
  // Trava do banco (trigger participants_guard_drawn): o grupo foi sorteado no meio do caminho.
  if ((e as { code?: string })?.code === "P0001") return "O sorteio deste grupo já foi feito. Recarregue a página para ver a situação atual.";
  return null;
}
