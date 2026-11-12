import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as q from "@/lib/queries";
import type { Wish } from "@/lib/queries";
import { formatDate, formatPhone, priceRange, siteUrl } from "@/lib/format";
import { ShareInvite } from "@/components/ShareInvite";
import { Reveal } from "@/components/Reveal";
import {
  addExclusion, addWish, deleteExclusion, deleteWish, removeParticipant, reopenGroup, runDraw, updatePhone,
} from "../../actions";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const user = await requireUser(`/grupos/${id}`);

  const group = await q.getGroupForMember(id, user.id);
  if (!group) notFound();

  const isOwner = group.owner_id === user.id;
  const drawn = group.status === "drawn";
  const [people, myWishes, receiver, rules] = await Promise.all([
    q.listParticipants(id),
    q.listWishes(group.me_id),
    drawn ? q.getMyMatch(id, user.id) : null,
    isOwner ? q.listExclusions(id, user.id) : [],
  ]);
  const me = people.find((p) => p.id === group.me_id);
  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.display_name ?? "?";

  const price = priceRange(group.min_value, group.max_value);
  const inviteUrl = `${siteUrl()}/g/${group.invite_code}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/grupos" className="text-sm text-stone-500">← Meus grupos</Link>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-stone-600">
          {[formatDate(group.event_date), group.location, price].filter(Boolean).join(" · ") || "Sem data definida"}
        </p>
      </div>

      {erro && <p className="error">{erro}</p>}

      {/* Resultado do sorteio */}
      {drawn && receiver && (
        <section className="card space-y-3 border-red-200">
          <Reveal groupId={id}>
            <div className="space-y-3 text-center">
              <p className="text-stone-600">Você tirou</p>
              <p className="text-3xl font-bold text-red-700">{receiver.name}</p>
              <p className="text-xs text-stone-500">É segredo! Só você vê isso.</p>
            </div>
            <WishList title={`Lista de desejos de ${receiver.name}`} wishes={receiver.wishes} empty="Ainda não colocou nada na lista." />
          </Reveal>
        </section>
      )}
      {!drawn && (
        <p className="card bg-amber-50 text-sm text-amber-900">
          O sorteio ainda não foi feito. Quando o organizador sortear, você recebe um e-mail.
        </p>
      )}

      {/* Minha lista de desejos */}
      {me && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Minha lista de desejos</h2>
          <ul className="space-y-2">
            {myWishes.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-2 text-sm">
                <WishItem wish={w} />
                <form action={deleteWish}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="group_id" value={id} />
                  <button className="text-stone-400 hover:text-red-700" aria-label="Remover">✕</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addWish} className="space-y-2">
            <input type="hidden" name="group_id" value={id} />
            <input className="input" name="description" required maxLength={200} placeholder="Ex.: livro de receitas, tamanho M..." />
            <input className="input" name="link" placeholder="Link da loja (opcional)" />
            <button className="btn-secondary w-full">Adicionar à lista</button>
          </form>
        </section>
      )}

      {/* WhatsApp para lembretes */}
      <section className="card space-y-2">
        <h2 className="font-semibold">Meu WhatsApp</h2>
        <p className="text-xs text-stone-500">Opcional. Você recebe aviso do sorteio e lembrete na véspera.</p>
        <form action={updatePhone} className="flex gap-2">
          <input type="hidden" name="group_id" value={id} />
          <input className="input" name="phone" type="tel" inputMode="tel" defaultValue={group.me_phone ? formatPhone(group.me_phone) : ""} placeholder="(11) 98765-4321" />
          <button className="btn-secondary shrink-0">Salvar</button>
        </form>
      </section>

      {/* Participantes */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Participantes ({people.length})</h2>
        <ul className="divide-y divide-stone-100">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {p.display_name}
                {p.user_id === group.owner_id && <span className="ml-2 text-xs text-stone-500">organizador</span>}
                {p.user_id === user.id && <span className="ml-2 text-xs text-stone-500">(você)</span>}
              </span>
              {isOwner && !drawn && p.user_id !== user.id && (
                <form action={removeParticipant}>
                  <input type="hidden" name="participant_id" value={p.id} />
                  <input type="hidden" name="group_id" value={id} />
                  <button className="text-xs text-stone-400 hover:text-red-700">remover</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {!drawn && (
          <>
            <h3 className="pt-2 text-sm font-semibold">Convide mais gente</h3>
            <ShareInvite url={inviteUrl} groupName={group.name} />
          </>
        )}
      </section>

      {/* Painel do organizador */}
      {isOwner && (
        <section className="card space-y-4 border-green-200">
          <h2 className="font-semibold">Painel do organizador</h2>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Quem não pode tirar quem</h3>
            <p className="text-xs text-stone-500">Ex.: casais. Vale nos dois sentidos.</p>
            <ul className="space-y-1 text-sm">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{nameOf(r.participant_a)} ✕ {nameOf(r.participant_b)}</span>
                  {!drawn && (
                    <form action={deleteExclusion}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="group_id" value={id} />
                      <button className="text-xs text-stone-400 hover:text-red-700">remover</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {!drawn && people.length >= 2 && (
              <form action={addExclusion} className="flex flex-wrap gap-2">
                <input type="hidden" name="group_id" value={id} />
                <PersonSelect name="a" people={people} />
                <PersonSelect name="b" people={people} />
                <button className="btn-secondary">Adicionar regra</button>
              </form>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            <form action={runDraw}>
              <input type="hidden" name="group_id" value={id} />
              <button className="btn" disabled={people.length < 3}>
                {drawn ? "Refazer sorteio" : "Fazer o sorteio"}
              </button>
            </form>
            {drawn && (
              <form action={reopenGroup}>
                <input type="hidden" name="group_id" value={id} />
                <button className="btn-secondary">Desfazer e reabrir para novas pessoas</button>
              </form>
            )}
          </div>
          {people.length < 3 && <p className="text-xs text-stone-500">Precisa de pelo menos 3 pessoas.</p>}
          {drawn && (
            <p className="text-xs text-stone-500">
              Refazer sorteia de novo e manda novo e-mail para todos. Nem você vê quem tirou quem.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function PersonSelect({ name, people }: { name: string; people: { id: string; display_name: string }[] }) {
  return (
    <select name={name} className="input w-auto flex-1" required defaultValue="">
      <option value="" disabled>Escolha</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
    </select>
  );
}

function WishItem({ wish }: { wish: Wish }) {
  return wish.link ? (
    <a href={wish.link} target="_blank" rel="noreferrer nofollow" className="text-red-700 underline">{wish.description}</a>
  ) : (
    <span>{wish.description}</span>
  );
}

function WishList({ title, wishes, empty }: { title: string; wishes: Wish[]; empty: string }) {
  return (
    <div className="space-y-1 border-t border-stone-100 pt-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {wishes.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {wishes.map((w) => <li key={w.id}><WishItem wish={w} /></li>)}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">{empty}</p>
      )}
    </div>
  );
}
