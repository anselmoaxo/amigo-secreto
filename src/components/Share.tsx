"use client";

import { useState } from "react";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Navegadores antigos ou sem permissão: usa um campo temporário.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

export const whatsappUrl = (text: string, phone?: string | null) =>
  `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;

export function CopyButton({ text, label = "Copiar", done = "Copiado", className = "btn btn-ghost btn-sm" }: { text: string; label?: string; done?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          setState((await copyText(text)) ? "ok" : "fail");
          setTimeout(() => setState("idle"), 2500);
        }}
      >
        {state === "ok" ? done : label}
      </button>
      <span role="status" className="sr-only">{state === "ok" ? done : state === "fail" ? "Não deu para copiar. Selecione o texto e copie manualmente." : ""}</span>
      {state === "fail" && <span className="text-[0.95rem] text-cherry">Não deu para copiar. Selecione e copie manualmente.</span>}
    </>
  );
}

/** Convite geral do grupo: mensagem pronta, WhatsApp e copiar. */
export function ShareInvite({ url, message }: { url: string; message: string }) {
  return (
    <div className="space-y-3">
      <label htmlFor="convite-msg" className="sr-only">Mensagem do convite</label>
      <textarea id="convite-msg" readOnly className="input hand min-h-36 text-[1.05rem]" value={message} onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-whats" target="_blank" rel="noreferrer" href={whatsappUrl(message)}>Enviar no WhatsApp</a>
        <CopyButton text={message} label="Copiar mensagem" done="Mensagem copiada" className="btn btn-ghost" />
        <CopyButton text={url} label="Copiar só o link" done="Link copiado" className="btn btn-ghost" />
      </div>
    </div>
  );
}
