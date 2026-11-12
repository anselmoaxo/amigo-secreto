import type { Metadata } from "next";
import Link from "next/link";
import { JoinWithCode } from "@/components/JoinWithCode";
import { SavedList } from "./SavedList";

export const metadata: Metadata = { title: "Meus grupos", robots: { index: false } };

export default function MyGroups() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-pine">Meus grupos</h1>
          <p className="mt-1 text-muted">
            Os grupos que você abriu <strong className="text-ink">neste aparelho</strong>. Em outro celular ou navegador, eles não aparecem.
          </p>
        </div>
        <SavedList />
      </div>

      <section aria-labelledby="abrir-convite" className="space-y-3 border-t border-line/70 pt-8">
        <h2 id="abrir-convite" className="text-xl font-bold text-pine">Abrir um convite ou link</h2>
        <p className="text-muted">Recebeu um convite ou o seu link pessoal e ele não abriu? Cole aqui.</p>
        <JoinWithCode label="Link, mensagem ou código" />
        <p className="text-[0.95rem] text-muted">
          Seu grupo não está na lista? <Link href="/recuperar" className="link">Receba seus links por e-mail</Link>.
        </p>
      </section>
    </div>
  );
}
