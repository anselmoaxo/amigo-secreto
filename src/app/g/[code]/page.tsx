import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getInvite } from "@/lib/queries";
import { sql } from "@/lib/db";
import { formatDate, priceRange } from "@/lib/format";
import { joinGroup } from "../../actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { code } = await params;
  const { erro } = await searchParams;
  const user = await requireUser(`/g/${encodeURIComponent(code)}`);

  const invite = await getInvite(code);
  if (!invite) return <p className="card">Convite não encontrado. Confira o link com quem te convidou.</p>;

  const [me] = await sql`select 1 from participants where group_id = ${invite.id} and user_id = ${user.id}`;
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
          <div>
        <label className="label" htmlFor="phone">Seu WhatsApp (opcional, para lembretes)</label>
        <input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" />
          </div>
          <button className="btn w-full">Entrar no grupo</button>
        </form>
      )}
    </div>
  );
}
