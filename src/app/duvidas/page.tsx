import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "Dúvidas frequentes e privacidade" };

export default function Faq() {
  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 py-8">
      <section className="space-y-6">
        <h1 className="text-3xl font-extrabold text-pine">Dúvidas frequentes</h1>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-line bg-sheet">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-3 font-bold marker:content-none">
                {f.q}
                <span aria-hidden className="text-xl text-pine transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="privacidade" aria-labelledby="priv" className="scroll-mt-6 space-y-4">
        <h2 id="priv" className="text-2xl font-bold text-pine">Como usamos os dados</h2>
        <ul className="space-y-3">
          {[
            ["O que guardamos", "Nome de cada participante, o e-mail ou WhatsApp que cada um informar (pelo menos um), a lista de desejos e o resultado do sorteio. Nada além disso."],
            ["Para que serve", "Só para esta brincadeira: mostrar o convite, avisar quando o sorteio sair, lembrar na véspera e reenviar links perdidos. Não vendemos nem compartilhamos dados, e não mandamos propaganda."],
            ["Quem vê o quê", "Cada pessoa vê só quem tirou. A lista de desejos aparece apenas para quem tirou aquela pessoa. E-mails e telefones ficam visíveis só para o organizador. Ninguém vê os pares, a não ser que o organizador tenha escolhido isso ao criar o grupo, e nesse caso todos são avisados."],
            ["Links", "Cada link tem um código longo e aleatório, impossível de adivinhar. O resultado nunca vai no endereço. Quem tiver o seu link consegue ver o seu resultado, por isso não repasse."],
            ["Quando apagamos", "Tudo é apagado 30 dias depois da data da festa. Grupos sem data são apagados um ano depois de criados. O organizador pode apagar tudo antes, no painel, em Encerrar e apagar o grupo."],
          ].map(([t, d]) => (
            <li key={t}>
              <p className="font-bold">{t}</p>
              <p className="text-muted">{d}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted">
          Quer tirar seus dados de um grupo? Peça ao organizador para remover você, ou <Link href="/recuperar" className="link">recupere seu link</Link> e apague sua lista e seu contato.
        </p>
      </section>
    </div>
  );
}
