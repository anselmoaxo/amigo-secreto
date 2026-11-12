"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Aceita o link inteiro do convite (ou só o código) e leva para a página certa. */
export function JoinWithCode() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    const m = v.match(/\/(g|p|o)\/([A-Za-z0-9_-]{6,64})/);
    if (m) return router.push(`/${m[1]}/${m[2]}`);
    if (/^[A-Za-z0-9_-]{6,32}$/.test(v)) return router.push(`/g/${v}`);
    setError(v ? "Não reconhecemos esse link. Copie a mensagem inteira do convite e cole aqui." : "Cole o link que você recebeu.");
  }

  return (
    <form onSubmit={go} className="space-y-2" noValidate>
      <label htmlFor="convite" className="block font-bold">Link ou código do convite</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="convite" className="input" value={value} autoComplete="off" inputMode="url"
          placeholder="Cole aqui o link que recebeu"
          aria-invalid={error ? true : undefined} aria-describedby={error ? "convite-erro" : undefined}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
        />
        <button className="btn btn-pine shrink-0">Abrir convite</button>
      </div>
      {error && <p id="convite-erro" className="text-[0.95rem] font-semibold text-cherry">{error}</p>}
    </form>
  );
}
