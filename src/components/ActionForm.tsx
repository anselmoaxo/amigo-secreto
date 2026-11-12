"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions/state";
import { Notice } from "./ui";

const Ctx = createContext<ActionState>({});
const PendingCtx = createContext(false);
export const useActionResult = () => useContext(Ctx);

/**
 * Formulário ligado a uma ação do servidor: mostra carregando, sucesso e erro,
 * e limpa os campos depois de dar certo (se resetOnSuccess).
 */
export function ActionForm({
  action, hidden = {}, children, className, resetOnSuccess, showSuccess = true, messageAt = "bottom", onSuccess,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  messageAt?: "top" | "bottom";
  onSuccess?: (s: ActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const cb = useRef(onSuccess);
  cb.current = onSuccess;

  const snapshot = useRef<Map<string, string | boolean> | null>(null);

  useEffect(() => {
    if (!state.at) return;
    // O React 19 limpa o formulário depois de enviar. Devolvemos o que a pessoa digitou,
    // a não ser quando deu certo e o formulário é para limpar (ex.: adicionar item).
    if (snapshot.current && ref.current && !(state.ok && resetOnSuccess)) writeValues(ref.current, snapshot.current);
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok) cb.current?.(state);
  }, [state, resetOnSuccess]);

  const msg = state.at ? (
    state.ok ? (showSuccess && state.message ? <Notice tone="success">{state.message}</Notice> : null) : state.error ? <Notice tone="error">{state.error}</Notice> : null
  ) : null;

  return (
    <Ctx.Provider value={state}>
      <PendingCtx.Provider value={pending}>
      <form ref={ref} action={formAction} onSubmit={(e) => { snapshot.current = readValues(e.currentTarget); }} className={className} noValidate>
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {messageAt === "top" && msg}
        {children}
        {messageAt === "bottom" && msg}
      </form>
      </PendingCtx.Provider>
    </Ctx.Provider>
  );
}

export function FieldError({ name, id }: { name: string; id?: string }) {
  const s = useActionResult();
  const e = s.fieldErrors?.[name];
  return e ? <p id={id} className="text-[0.95rem] font-semibold text-cherry">{e}</p> : null;
}

/** Botão de envio com estado de carregamento. */
export function Submit({
  children, pending = "Salvando…", className = "btn btn-pine", disabled, name, value, ...rest
}: { children: ReactNode; pending?: string; className?: string; disabled?: boolean; name?: string; value?: string } & React.AriaAttributes) {
  const status = useFormStatus();
  const busy = useContext(PendingCtx) || status.pending;
  return (
    <button type="submit" name={name} value={value} className={className} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <><Spinner />{pending}</> : children}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

/** Campo de texto que mostra o erro vindo da ação do servidor. */
export function TextField({
  name, label, hint, optional, as = "input", id, ...input
}: {
  name: string; label: ReactNode; hint?: ReactNode; optional?: boolean; as?: "input" | "textarea"; id?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  const s = useActionResult();
  const fid = id ?? `f-${name}`;
  const error = s.fieldErrors?.[name];
  const describedBy = [hint && `${fid}-hint`, error && `${fid}-error`].filter(Boolean).join(" ") || undefined;
  const common = { id: fid, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, className: "input" };
  return (
    <div className="space-y-1.5">
      <label htmlFor={fid} className="block font-bold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(opcional)</span>}
      </label>
      {hint && <p id={`${fid}-hint`} className="text-[0.95rem] text-muted">{hint}</p>}
      {as === "textarea" ? <textarea {...common} {...(input as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} /> : <input {...common} {...(input as React.InputHTMLAttributes<HTMLInputElement>)} />}
      {error && <p id={`${fid}-error`} className="text-[0.95rem] font-semibold text-cherry">{error}</p>}
    </div>
  );
}

type Values = Map<string, string | boolean>;

/** Guarda os valores digitados (campos de texto, selects e caixas de marcar). */
export function readValues(form: HTMLFormElement): Values {
  const v: Values = new Map();
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
    if (el instanceof HTMLInputElement && el.type === "hidden") continue;
    v.set(el.name, el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value);
  }
  return v;
}

export function writeValues(form: HTMLFormElement, v: Values) {
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !v.has(el.name)) continue;
    const val = v.get(el.name)!;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = val as boolean;
    else el.value = val as string;
  }
}

/** Para formulários que usam useActionState direto: devolve o "carregando" ao <Submit>. */
export const PendingProvider = PendingCtx.Provider;
