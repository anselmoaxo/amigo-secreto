import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { formatDate, priceRange } from "@/lib/format";
import { joinGroup } from "../../actions";

type Invite = {
  id: string; name: string; event_date: string | null; location: string | null;
  min_value: number | null; max_value: number | null; status: string; members: number;
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { code } = await params;
  const { erro } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/g/${code}`);

  const { data } = await supabase.rpc("get_invite", { p_code: code });
  const invite = (data as Invite[] | null)?.[0];
  if (!invite) return <p className="card">Convite não encontrado. Confira o link com quem te convidou.</p>;

  const { data: me } = await supabase
    .from("participants").select("id").eq("group_id", invite.id).eq("user_id", user.id).maybeSingle();
  if (me) redirect(`/grupos/${invite.id}`);

  const price = priceRange(invite.min_value, invite.max_value);
  return (
    <div className="card space-y-4">
      <h1 className="text-xl font-bold">Você foi convidado para o amigo secreto</h1>
      <div>
        <p className="text-lg font-semibold">{invite.name}</p>
        <p className="text-sm text-stone-600">
          {invite.members} {invite.members === 1 ? "pessoa já entrou" : "pessoas já entraram"}
          {invite.event_date && ` · ${formatDate(invite.event_date)}`}
          {invite.location && ` · ${invite.location}`}
          {price && ` · ${price}`}
        </p>
      </div>
      {invite.status !== "open" ? (
        <p className="error">O sorteio deste grupo já foi feito. Peça ao organizador para reabrir.</p>
      ) : (
        <form action={joinGroup} className="space-y-3">
          {erro && <p className="error">{erro}</p>}
          <input type="hidden" name="code" value={code} />
          <div>
            <label className="label" htmlFor="display_name">Seu nome</label>
            <input className="input" id="display_name" name="display_name" required maxLength={60} />
          </div>
          <button className="btn w-full">Entrar no grupo</button>
        </form>
      )}
    </div>
  );
}
