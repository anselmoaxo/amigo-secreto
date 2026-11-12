"use client";

import { useState } from "react";

export function ShareInvite({ url, groupName }: { url: string; groupName: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Entra no nosso amigo secreto "${groupName}": ${url}`;
  return (
    <div className="space-y-2">
      <input className="input text-sm" readOnly value={url} onFocus={(e) => e.target.select()} />
      <div className="flex flex-wrap gap-2">
        <a className="btn-green" target="_blank" rel="noreferrer"
           href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
          Enviar no WhatsApp
        </a>
        <button type="button" className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}>
          {copied ? "Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
