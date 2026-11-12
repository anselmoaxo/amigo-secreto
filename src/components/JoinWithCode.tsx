"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { parseInviteInput } from "@/lib/links";
import { Spinner } from "./ActionForm";

/**
 * Aceita o link inteiro do convite, a mensagem inteira do WhatsApp ou só o código,
 * e leva para a página certa deste site (nunca para fora).
 */
export function JoinWithCode({ label = "Link ou código do convite" }: { label?: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (opening) return;
    const r = parseInviteInput(value, window.location.host);
    if (!r.ok) {
      setError(r.error);
      document.getElementById(`${id}-input`)?.focus();
      return;
    }
    setOpening(true);
    router.push(r.path);
  }

  return (
    <form onSubmit={go} className="space-y-2" noValidate>
      <label htmlFor={`${id}-input`} className="block font-bold">{label}</label>
      <p id={`${id}-hint`} className="text-[0.95rem] text-muted">Pode colar a mensagem inteira que você recebeu. A gente acha o link.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-input`} className="input" value={value} autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="Cole aqui o link que recebeu"
          aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-erro` : ""}`}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
        />
        <button className="btn btn-pine shrink-0" disabled={opening} aria-busy={opening || undefined}>
          {opening ? <><Spinner />Abrindo…</> : "Abrir convite"}
        </button>
      </div>
      <p id={`${id}-erro`} role="alert" className="text-[0.95rem] font-semibold text-cherry empty:hidden">{error}</p>
    </form>
  );
}
