import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-4 text-center">
        <h1 className="text-3xl font-bold">Amigo secreto sem papelzinho</h1>
        <p className="text-stone-600">
          Crie o grupo, mande o link no WhatsApp e faça o sorteio. Cada pessoa vê só quem tirou,
          nem o organizador sabe.
        </p>
        <Link href="/grupos/novo" className="btn text-lg">Criar meu grupo</Link>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Convite por link", "Todo mundo entra só com o e-mail, sem senha."],
          ["Sorteio justo", "Ninguém tira a si mesmo, e casais podem ficar de fora um do outro."],
          ["Lista de desejos", "Cada um diz o que quer ganhar, com links das lojas."],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h2 className="font-semibold">{t}</h2>
            <p className="text-sm text-stone-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
