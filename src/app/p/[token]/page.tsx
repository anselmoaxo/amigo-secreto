import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addWishAction, contactAction, deleteWishAction, preferencesAction, respondAction } from "@/app/actions/participant";
import { ActionForm, Submit, TextField } from "@/components/ActionForm";
import { GroupTag } from "@/components/GroupTag";
import { RememberLink } from "@/components/RememberLink";
import { Empty, Notice, Section } from "@/components/ui";
import { formatDate, formatPhone } from "@/lib/format";
import * as q from "@/lib/queries";
import { Reveal } from "./Reveal";

export const metadata: Metadata = { title: "Meu amigo secreto", robots: { index: false } };

export default async function ParticipantPage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ bemvindo?: string }> }) {
  const { token } = await params;
  const { bemvindo } = await searchParams;
  const res = await q.getByAccessToken(token);
  if (!res) notFound();
  const { me, group } = res;
  const drawn = group.status === "drawn";
  const [wishes, assigned] = await Promise.all([
    q.listWishes(me.id),
    drawn ? q.getMyMatch(me, group).then(Boolean) : false,
  ]);
  const wishOpen = q.wishlistOpen(group);
  const hidden = { t: token };

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <RememberLink kind="participant" token={token} group={group.name} person={me.display_name} />

      {bemvindo && (
        <Notice tone="success" title="Você entrou no grupo!">
          Esta página é o seu link pessoal. Ela ficou salva em Meus grupos neste aparelho
          {me.email ? " e mandamos o link para o seu e-mail" : ""}. Não repasse o endereço.
        </Notice>
      )}

      <div className="space-y-3">
        <p className="text-lg">Oi, <strong>{me.display_name}</strong>!</p>
        <GroupTag group={group} />
        {group.organizer_name && <p className="text-[0.95rem] text-muted">Organizado por {group.organizer_name}.</p>}
        {group.organizer_can_see_pairs && (
          <Notice tone="warn">Neste grupo, o organizador escolheu poder ver todos os pares do sorteio.</Notice>
        )}
      </div>

      {/* Resultado ou situação */}
      <section aria-labelledby="resultado" className="space-y-4">
        <h2 id="resultado" className="sr-only">Seu sorteio</h2>
        {drawn && assigned && <Reveal token={token} wishlist={group.wishlist_enabled} />}
        {drawn && !assigned && (
          <Notice tone="info" title="Você não entrou neste sorteio.">
            {me.status === "declined" ? "Você avisou que não ia participar." : "Você entrou depois do sorteio."} Se quiser participar, fale com o organizador.
          </Notice>
        )}
        {!drawn && <Rsvp token={token} me={me} group={group} />}
      </section>

      {group.wishlist_enabled && me.status !== "declined" && (
        <Section id="lista" title="Minha lista de desejos"
          intro={wishOpen
            ? `Só quem tirar você vê esta lista.${group.wishlist_until ? ` Dá para mudar até ${formatDate(group.wishlist_until)}.` : ""}`
            : "O prazo para mudar a lista terminou."}>
          <ActionForm action={preferencesAction} hidden={hidden} className="space-y-3">
            <TextField as="textarea" name="preferences" id="preferences" label="Gostos, tamanhos e preferências" optional
              hint="Ex.: camiseta M, calçado 38, gosto de café e de livros de suspense. Não gosto de perfume."
              defaultValue={me.preferences ?? ""} maxLength={500} rows={3} disabled={!wishOpen} />
            {wishOpen && <Submit className="btn btn-ghost btn-sm">Salvar preferências</Submit>}
          </ActionForm>

          <div className="space-y-3">
            <h3 className="font-bold">Sugestões de presente</h3>
            {wishes.length === 0 ? (
              <Empty title="Nenhuma sugestão ainda">{wishOpen ? "Adicione ideias para facilitar a vida de quem tirar você." : null}</Empty>
            ) : (
              <ul className="sheet divide-y divide-line px-4">
                {wishes.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                    {w.link ? <a href={w.link} target="_blank" rel="noreferrer nofollow" className="link">{w.description}</a> : <span>{w.description}</span>}
                    {wishOpen && (
                      <ActionForm action={deleteWishAction} hidden={{ ...hidden, id: w.id }} showSuccess={false}>
                        <Submit className="link link-danger py-1" pending="Removendo…" aria-label={`Remover ${w.description}`}>Remover</Submit>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {wishOpen && wishes.length < 15 && (
              <ActionForm action={addWishAction} hidden={hidden} resetOnSuccess className="space-y-3 rounded-xl border border-line bg-sheet p-4">
                <TextField name="description" id="wish-description" label="Sugestão" maxLength={200} placeholder="Ex.: Livro de receitas" autoComplete="off" />
                <TextField name="link" id="wish-link" label="Link da loja" optional inputMode="url" placeholder="Cole o endereço do produto" autoComplete="off" />
                <Submit className="btn btn-pine btn-sm" pending="Adicionando…">Adicionar à lista</Submit>
              </ActionForm>
            )}
          </div>
        </Section>
      )}

      <Section id="contato" title="Avisos" intro="Opcional. Usamos só para mandar o aviso do sorteio, o lembrete na véspera e seus links se você perder.">
        <ActionForm action={contactAction} hidden={hidden} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="email" id="c-email" label="E-mail" optional type="email" inputMode="email" autoComplete="email" defaultValue={me.email ?? ""} />
            <TextField name="phone" id="c-phone" label="WhatsApp" optional type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" defaultValue={me.phone ? formatPhone(me.phone) : ""} />
          </div>
          <Submit className="btn btn-ghost btn-sm">Salvar contato</Submit>
        </ActionForm>
      </Section>

      <aside className="rounded-xl bg-paper-deep/60 p-4 text-[0.95rem] text-muted">
        <p>
          <strong className="text-ink">Este link é só seu.</strong> Quem tiver o link vê o seu resultado, então não repasse.
          Ele ficou salvo neste aparelho em <Link href="/meus-grupos" className="link">Meus grupos</Link>.{" "}
          <Link href="/duvidas#privacidade" className="link">Como usamos seus dados</Link>.
        </p>
      </aside>
    </div>
  );
}

function Rsvp({ token, me, group }: { token: string; me: q.Participant; group: q.Group }) {
  const hidden = { t: token };
  if (me.status === "pending") {
    return (
      <div className="slip space-y-4 px-6 py-7">
        <p className="text-xl font-bold text-pine">Você vai participar?</p>
        {group.rsvp_deadline && <p className="text-muted">Responda até {formatDate(group.rsvp_deadline)}.</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionForm action={respondAction} hidden={{ ...hidden, answer: "confirmed" }} showSuccess={false}>
            <Submit className="btn btn-primary w-full" pending="Confirmando…">Sim, vou participar</Submit>
          </ActionForm>
          <ActionForm action={respondAction} hidden={{ ...hidden, answer: "declined" }} showSuccess={false}>
            <Submit className="btn btn-ghost w-full" pending="Enviando…">Não vou poder</Submit>
          </ActionForm>
        </div>
      </div>
    );
  }
  if (me.status === "declined") {
    return (
      <Notice tone="info" title="Você avisou que não vai participar.">
        <ActionForm action={respondAction} hidden={{ ...hidden, answer: "confirmed" }} showSuccess={false} className="mt-3">
          <Submit className="btn btn-ghost btn-sm" pending="Confirmando…">Mudei de ideia, vou participar</Submit>
        </ActionForm>
      </Notice>
    );
  }
  return (
    <div className="slip space-y-2 px-6 py-7">
      <p className="text-xl font-bold text-pine">Presença confirmada.</p>
      <p className="text-muted">
        Quando o sorteio sair, seu papelzinho aparece aqui{me.email || me.phone ? " e você recebe um aviso" : ""}.
        {group.wishlist_enabled ? " Enquanto isso, monte sua lista de desejos." : ""}
      </p>
      {!me.is_organizer && (
        <ActionForm action={respondAction} hidden={{ ...hidden, answer: "declined" }} showSuccess={false}>
          <Submit className="link link-danger mt-1 py-1 text-[0.95rem]" pending="Enviando…">Não vou mais poder participar</Submit>
        </ActionForm>
      )}
    </div>
  );
}
