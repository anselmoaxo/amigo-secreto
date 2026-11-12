"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-14" role="alert">
      <h1 className="text-3xl font-extrabold text-pine">Não conseguimos carregar esta página</h1>
      <p>Pode ser a sua conexão ou uma falha rápida do nosso lado. Nada do que você salvou foi perdido.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="btn btn-pine" onClick={() => reset()}>Tentar de novo</button>
        <Link href="/" className="btn btn-ghost">Ir para o início</Link>
      </div>
    </div>
  );
}
