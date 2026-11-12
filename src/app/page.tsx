import Link from "next/link";
import { JoinWithCode } from "@/components/JoinWithCode";
import { Notice } from "@/components/ui";
import { FAQ } from "@/lib/faq";

const STEPS = [
  ["Crie o grupo", "Nome, data, valor do presente e regras. Leva uns dois minutos."],
  ["Convide", "Mande o convite no grupo do WhatsApp ou o link de cada pessoa."],
  ["Sorteie", "O site confere as regras e sorteia. Ninguém tira a si mesmo."],
  ["Cada um vê o seu", "Pelo próprio link, com a lista de desejos de quem tirou."],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ apagado?: string }> }) {
  const { apagado } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4">
      {apagado && <Notice tone="success" className="mt-6">Grupo encerrado. Todos os dados dele foram apagados.</Notice>}

      <section className="grid items-center gap-10 py-10 sm:py-16 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-pine sm:text-6xl">
            Amigo secreto sem papelzinho perdido.
          </h1>
          <p className="max-w-[34ch] text-lg text-muted sm:text-xl">
            Crie o grupo, convide pelo WhatsApp e sorteie. Cada pessoa vê só quem tirou, sem criar conta.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/criar" className="btn btn-primary text-lg">Criar amigo secreto</Link>
            <a href="#convite" className="btn btn-ghost text-lg">Tenho um convite</a>
          </div>
        </div>
        <SlipStack />
      </section>

      <section aria-labelledby="como" className="border-t border-line/70 py-12">
        <h2 id="como" className="text-2xl font-bold text-pine">Como funciona</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 lg:flex-col lg:gap-2">
              <span aria-hidden className="hand flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-xl font-bold text-gold-ink">{i + 1}</span>
              <div>
                <h3 className="font-bold">{t}</h3>
                <p className="text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="convite" aria-labelledby="convite-titulo" className="scroll-mt-6 border-t border-line/70 py-12">
        <div className="max-w-xl space-y-4">
          <h2 id="convite-titulo" className="text-2xl font-bold text-pine">Recebeu um convite?</h2>
          <p className="text-muted">Abra o link que mandaram para você. Se ele não abrir, cole aqui.</p>
          <JoinWithCode />
          <p className="text-[0.95rem] text-muted">
            Já entrou e perdeu o link? <Link href="/recuperar" className="link">Receba seus links por e-mail</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="duvidas" className="border-t border-line/70 py-12">
        <h2 id="duvidas" className="text-2xl font-bold text-pine">Dúvidas frequentes</h2>
        <dl className="mt-6 grid gap-6 md:grid-cols-3">
          {FAQ.filter((f) => f.home).map((f) => (
            <div key={f.q}>
              <dt className="font-bold">{f.q}</dt>
              <dd className="mt-1 text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6"><Link href="/duvidas" className="link">Ver todas as dúvidas</Link></p>
      </section>
    </div>
  );
}

/** Ilustração: papeizinhos com nomes escritos à mão, um deles aberto. */
function SlipStack() {
  const names = ["Ana", "Caio", "Duda"];
  return (
    <div aria-hidden className="relative mx-auto h-80 w-full max-w-sm select-none">
      {names.map((n, i) => (
        <div
          key={n}
          className="slip hand absolute flex h-20 w-36 items-center justify-center text-2xl font-bold text-pine/80"
          style={{ left: `${[0, 34, 62][i]}%`, top: `${[4, 20, 0][i]}%`, transform: `rotate(${[-8, 5, -4][i]}deg)` }}
        >
          {n}
        </div>
      ))}
      <div className="slip absolute bottom-0 left-[12%] w-60 rotate-[3deg] px-6 py-5">
        <p className="text-[0.95rem] text-muted">Você tirou</p>
        <p className="hand text-5xl font-bold text-cherry">Bia</p>
        <p className="mt-2 border-t border-dashed border-line pt-2 text-[0.9rem] text-muted">Quer: livro de receitas, tamanho M</p>
      </div>
    </div>
  );
}
