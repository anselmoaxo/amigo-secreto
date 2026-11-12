import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createGroup } from "../../actions";

export default async function NewGroup({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/grupos/novo");
  const { erro } = await searchParams;

  return (
    <form action={createGroup} className="card space-y-4">
      <h1 className="text-xl font-bold">Novo grupo</h1>
      {erro && <p className="error">{erro}</p>}
      <div>
        <label className="label" htmlFor="name">Nome do grupo</label>
        <input className="input" id="name" name="name" required maxLength={80} placeholder="Família Silva 2026" />
      </div>
      <div>
        <label className="label" htmlFor="display_name">Seu nome no grupo</label>
        <input className="input" id="display_name" name="display_name" required maxLength={60} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="event_date">Data da festa</label>
          <input className="input" id="event_date" name="event_date" type="date" />
        </div>
        <div>
          <label className="label" htmlFor="location">Local</label>
          <input className="input" id="location" name="location" maxLength={120} placeholder="Casa da vó" />
        </div>
        <div>
          <label className="label" htmlFor="min_value">Valor mínimo (R$)</label>
          <input className="input" id="min_value" name="min_value" inputMode="decimal" placeholder="50" />
        </div>
        <div>
          <label className="label" htmlFor="max_value">Valor máximo (R$)</label>
          <input className="input" id="max_value" name="max_value" inputMode="decimal" placeholder="100" />
        </div>
      </div>
      <button className="btn w-full">Criar grupo</button>
    </form>
  );
}
