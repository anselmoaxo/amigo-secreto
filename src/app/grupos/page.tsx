import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function MyGroups() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/grupos");

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, event_date, status, owner_id")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus grupos</h1>
        <Link href="/grupos/novo" className="btn">Novo grupo</Link>
      </div>
      {!groups?.length && (
        <p className="card text-stone-600">Você ainda não está em nenhum grupo. Crie um ou abra um convite.</p>
      )}
      <ul className="space-y-2">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link href={`/grupos/${g.id}`} className="card block hover:border-red-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{g.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${g.status === "drawn" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {g.status === "drawn" ? "Sorteado" : "Aguardando sorteio"}
                </span>
              </div>
              <p className="text-sm text-stone-600">
                {g.owner_id === user.id ? "Você organiza" : "Participante"}
                {g.event_date && ` · ${formatDate(g.event_date)}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <form action="/auth/sair" method="post">
        <button className="text-sm text-stone-500 underline">Sair ({user.email})</button>
      </form>
    </div>
  );
}
