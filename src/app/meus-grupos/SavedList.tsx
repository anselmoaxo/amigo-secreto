"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty } from "@/components/ui";
import { forgetLink, readLinks, type SavedLink } from "@/lib/saved";

export function SavedList() {
  const [links, setLinks] = useState<SavedLink[] | null>(null);
  useEffect(() => setLinks(readLinks()), []);

  if (links === null) return <p className="text-muted" role="status">Carregando…</p>;
  if (links.length === 0) {
    return (
      <Empty title="Nenhum grupo neste aparelho">
        <p>Crie um amigo secreto ou, se você já participa de um, receba seus links por e-mail.</p>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/criar" className="btn btn-primary">Criar amigo secreto</Link>
          <Link href="/recuperar" className="btn btn-ghost">Receber meus links</Link>
        </div>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="sheet divide-y divide-line px-4 sm:px-5">
        {links.map((l) => (
          <li key={`${l.kind}-${l.token}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-bold">{l.group}</p>
              <p className="text-[0.95rem] text-muted">{l.kind === "admin" ? "Você organiza" : `Você participa${l.person ? ` como ${l.person}` : ""}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/${l.kind === "admin" ? "o" : "p"}/${l.token}`} className="btn btn-pine btn-sm">
                {l.kind === "admin" ? "Abrir painel" : "Abrir"}
              </Link>
              <button type="button" className="link link-danger text-[0.95rem]"
                onClick={() => { forgetLink(l.kind, l.token); setLinks(readLinks()); }}
                aria-label={`Tirar ${l.group} deste aparelho`}>
                Tirar daqui
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[0.95rem] text-muted">&quot;Tirar daqui&quot; só esquece o link neste aparelho. O grupo continua existindo.</p>
    </div>
  );
}
