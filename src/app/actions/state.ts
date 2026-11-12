import { AppError } from "@/lib/queries";
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
    if (e instanceof AppError) return failed(e.message);
    // redirect() e notFound() do Next usam exceções: deixamos passar.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return failed(fallback);
  }
}
