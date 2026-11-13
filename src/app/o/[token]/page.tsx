import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addPersonAction, addRuleAction, deleteGroupAction, deleteRuleAction } from "@/app/actions/organizer";
import { ActionForm, Submit, TextField } from "@/components/ActionForm";
import { GroupTag } from "@/components/GroupTag";
import { RememberLink } from "@/components/RememberLink";
import { LinkBadge, LinkWarning } from "@/components/LinkKind";
import { CopyButton, ShareInvite } from "@/components/Share";
import { whatsappUrl } from "@/lib/links";
import { Empty, Notice, Section } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { adminUrl, emailEnabled, groupInviteText, inviteUrl, participantUrl } from "@/lib/notify";
import * as q from "@/lib/queries";
import { todayBR } from "@/lib/validation";
import { MIN_PEOPLE } from "@/lib/draw";
import { DrawPanel } from "./DrawPanel";
import { PersonRow } from "./PersonRow";

export const metadata: Metadata = { title: "Painel do organizador", robots: { index: false } };

export default async function OrganizerPage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { token } = await params;
  const { novo } = await searchParams;
  const group = await q.getGroupByAdminToken(token);
  if (!group) notFound();

  const [people, rules, revealed] = await Promise.all([
    q.listParticipants(group.id),
    q.listExclusions(group.id),
    q.revealedCount(group.id),
  ]);
  const drawn = group.status === "drawn";
  const problem = drawn ? null : await q.checkGroupDraw(group.id);
  const me = people.find((p) => p.is_organizer);
  const myLink = me ? participantUrl(await q.participantToken(me.id)) : null;

  const active = people.filter((p) => p.status !== "declined");
  const count = {
    total: active.length,
    confirmed: people.filter((p) => p.status === "confirmed").length,
    pending: people.filter((p) => p.status === "pending").length,
    declined: people.filter((p) => p.status === "declined").length,
  };
  const name = (id: string) => people.find((p) => p.id === id)?.display_name ?? "?";
  const canChange = group.allow_changes && !drawn;
  const today = todayBR();
  const rsvpPassed = group.rsvp_deadline && group.rsvp_deadline < today;
  const noContact = active.filter((p) => !p.is_organizer && !p.email && !p.phone);
  const teams = [...new Set(people.map((p) => p.team).filter(Boolean))] as string[];

  const warnings: React.ReactNode[] = [];
  if (!drawn && count.pending > 0) {
    warnings.push(
      <>{count.pending} {count.pending === 1 ? "pessoa ainda não confirmou" : "pessoas ainda não confirmaram"}. Quem não responder entra no sorteio mesmo assim.{rsvpPassed ? " O prazo de confirmação já passou." : ""}</>,
    );
  }
  if (drawn && noContact.length > 0) {
    warnings.push(<>{noContact.map((p) => p.display_name).join(", ")} não {noContact.length === 1 ? "tem" : "têm"} e-mail nem WhatsApp. Envie o link pessoal pelo botão Enviar link.</>);
  }
  if (drawn && revealed < count.total) {
    warnings.push(<>{count.total - revealed} {count.total - revealed === 1 ? "pessoa ainda não viu" : "pessoas ainda não viram"} quem tirou.</>);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <RememberLink kind="admin" token={token} group={group.name} />

      {novo && (
        <div className="sheet space-y-4 border-pine/30 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-pine">Grupo criado! Guarde este painel.</h2>
          <LinkBadge kind="admin" />
          <p>
            Este endereço é o seu painel de organizador. Ele ficou salvo neste aparelho em <Link href="/meus-grupos" className="link">Meus grupos</Link>
            {group.organizer_email && emailEnabled() ? <> e também foi para <strong>{group.organizer_email}</strong></> : null}.
          </p>
          <LinkWarning kind="admin" />
          {!group.organizer_email && (
            <Notice tone="warn" title="Antes de sair, guarde o link do painel.">
              Você não informou e-mail, então não dá para recuperar este painel em “Perdi meu link”.
              Copie o link e mande para você mesmo no WhatsApp, ou salve nos favoritos do navegador.
              Se preferir, <Link href={`/o/${token}/editar`} className="link">adicione um e-mail</Link>.
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton text={adminUrl(token)} label="Copiar link do painel" done="Link do painel copiado" className="btn btn-pine btn-sm" />
            {!group.organizer_email && (
              <a className="btn btn-whats btn-sm" target="_blank" rel="noreferrer"
                href={whatsappUrl(`Meu painel do amigo secreto "${group.name}" (não repasse): ${adminUrl(token)}`)}>
                Mandar para mim no WhatsApp
              </a>
            )}
            {myLink && <a href={myLink} className="btn btn-ghost btn-sm">Abrir minha página de participante</a>}
          </div>
        </div>
      )}

      <GroupTag group={group} showDescription={false}>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/o/${token}/editar`} className="btn btn-ghost btn-sm">Editar grupo</Link>
          {myLink && <a href={myLink} className="btn btn-ghost btn-sm">Ver como participante</a>}
        </div>
      </GroupTag>

      {/* Situação geral */}
      <section aria-label="Andamento do amigo secreto" className="space-y-4">
        <Progress steps={[
          { title: "Convidar", detail: `${count.total} ${count.total === 1 ? "pessoa" : "pessoas"} no grupo`, done: drawn || count.total >= MIN_PEOPLE, href: canChange ? "#convidar" : "#participantes" },
          { title: "Confirmar", detail: `${count.confirmed} de ${count.total} confirmaram`, done: drawn || count.pending === 0, href: "#participantes", bar: count.total ? count.confirmed / count.total : 0 },
          { title: "Sortear", detail: drawn ? "Sorteio feito" : "Ainda não sorteado", done: drawn, href: "#sorteio" },
          { title: "Cada um vê o seu", detail: drawn ? `${revealed} de ${count.total} já viram` : "Depois do sorteio", done: drawn && revealed >= count.total, href: "#participantes", bar: drawn && count.total ? revealed / count.total : undefined },
        ]} />
        {warnings.map((w, i) => <Notice key={i} tone="warn">{w}</Notice>)}
        {count.declined > 0 && <p className="text-muted">{count.declined} {count.declined === 1 ? "pessoa avisou que não vai" : "pessoas avisaram que não vão"} e não {count.declined === 1 ? "entra" : "entram"} no sorteio.</p>}
      </section>

      {canChange && (
        <Section id="convidar" title="Convidar pelo grupo" intro="Quem abrir este convite escreve o próprio nome e recebe um link pessoal, só dele.">
          <LinkBadge kind="invite" />
          <ShareInvite url={inviteUrl(group.invite_code)} message={groupInviteText(group)} />
          {group.rsvp_deadline && (
            <p className="text-[0.95rem] text-muted">O convite aceita gente nova até {formatDate(group.rsvp_deadline)}.</p>
          )}
        </Section>
      )}

      <Section id="participantes" title={`Participantes (${people.length})`}
        intro={drawn ? "O sorteio já foi feito. Para mudar a lista, desfaça o sorteio." : group.allow_changes ? undefined : "A lista está fechada. Libere em Editar grupo para adicionar ou remover pessoas."}>
        {people.length === 0 ? (
          <Empty title="Ninguém no grupo ainda">Mande o convite acima ou adicione as pessoas aqui embaixo.</Empty>
        ) : (
          <ul className="sheet divide-y divide-line px-4 sm:px-5">
            {people.map((p) => (
              <PersonRow key={p.id} t={token} drawn={drawn} canChange={canChange}
                p={{ id: p.id, name: p.display_name, email: p.email, phone: p.phone, team: p.team, status: p.status, isOrganizer: p.is_organizer, revealed: p.revealed, inviteSent: Boolean(p.invite_sent_at) }} />
            ))}
          </ul>
        )}
        <datalist id="nucleos">{teams.map((t) => <option key={t} value={t} />)}</datalist>

        {canChange && (
          <details className="group rounded-xl border border-line bg-sheet">
            <summary className="flex min-h-12 cursor-pointer items-center px-5 font-bold text-pine marker:content-none">
              <span aria-hidden className="mr-2 text-xl transition-transform group-open:rotate-45">+</span> Adicionar participante
            </summary>
            <ActionForm action={addPersonAction} hidden={{ t: token }} resetOnSuccess className="space-y-4 px-5 pb-5">
              <TextField name="name" id="add-name" label="Nome" maxLength={60} autoComplete="off" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="email" id="add-email" label="E-mail" optional type="email" inputMode="email" autoComplete="off" />
                <TextField name="phone" id="add-phone" label="WhatsApp" optional type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 98765-4321" />
              </div>
              <TextField name="team" id="add-team" label="Núcleo" optional maxLength={40} list="nucleos" hint="Quem tem o mesmo núcleo não se tira. Ex.: Casa da Ana" />
              {emailEnabled() && (
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="send" defaultChecked className="mt-1 h-5 w-5 accent-[var(--color-pine)]" />
                  <span>Enviar o link por e-mail, se houver</span>
                </label>
              )}
              <Submit pending="Adicionando…">Adicionar</Submit>
            </ActionForm>
          </details>
        )}
      </Section>

      <Section id="regras" title="Quem não pode tirar quem"
        intro="Ninguém tira a si mesmo, isso é automático. Para separar casais ou famílias, use o mesmo núcleo em Editar de cada pessoa, ou crie regras aqui.">
        {teams.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <li key={t} className="rounded-full bg-gold-soft px-3 py-1 text-[0.95rem] text-gold-ink">
                <strong>{t}:</strong> {people.filter((p) => p.team === t).map((p) => p.display_name).join(", ")}
              </li>
            ))}
          </ul>
        )}
        {rules.length === 0 ? (
          <p className="text-muted">Nenhuma regra entre pessoas.</p>
        ) : (
          <ul className="sheet divide-y divide-line px-4 sm:px-5">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {r.one_way
                    ? <><strong>{name(r.participant_a)}</strong> não pode tirar <strong>{name(r.participant_b)}</strong></>
                    : <><strong>{name(r.participant_a)}</strong> e <strong>{name(r.participant_b)}</strong> não se tiram</>}
                </span>
                {!drawn && (
                  <ActionForm action={deleteRuleAction} hidden={{ t: token, id: r.id }} showSuccess={false}>
                    <Submit className="link link-danger py-1" pending="Removendo…" aria-label={`Remover regra entre ${name(r.participant_a)} e ${name(r.participant_b)}`}>Remover</Submit>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {!drawn && active.length >= 2 && (
          <ActionForm action={addRuleAction} hidden={{ t: token }} className="space-y-3 rounded-xl border border-line bg-sheet p-5">
            <p className="font-bold">Nova regra</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <PersonSelect id="rule-a" name="a" label="Pessoa" people={active} />
              <div className="space-y-1.5">
                <label htmlFor="rule-dir" className="block font-bold">Regra</label>
                <select id="rule-dir" name="direction" className="input" defaultValue="both">
                  <option value="both">não se tiram (nenhum dos dois)</option>
                  <option value="one">não pode tirar</option>
                </select>
              </div>
              <PersonSelect id="rule-b" name="b" label="Outra pessoa" people={active} />
            </div>
            <Submit className="btn btn-ghost" pending="Salvando…">Adicionar regra</Submit>
          </ActionForm>
        )}
      </Section>

      <Section id="sorteio" title="Sorteio">
        <div className="sheet p-5 sm:p-6">
          <DrawPanel t={token} drawn={drawn} revealed={revealed} total={count.total} problem={problem} canSeePairs={group.organizer_can_see_pairs} />
        </div>
      </Section>

      <Section id="encerrar" title="Encerrar e apagar o grupo"
        intro={`Apaga o grupo, os participantes, as listas de desejos e o sorteio. Não dá para desfazer. Se você não fizer nada, apagamos tudo 30 dias depois da festa${group.event_date ? ` (${formatDate(group.event_date)})` : ""}.`}>
        <details className="rounded-xl border border-cherry/30 bg-sheet">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-bold text-cherry marker:content-none">Quero apagar o grupo agora</summary>
          <ActionForm action={deleteGroupAction} hidden={{ t: token }} className="space-y-3 px-5 pb-5">
            <TextField name="confirm_name" id="confirm-name" label={<>Digite <span className="hand">{group.name}</span> para confirmar</>} autoComplete="off" />
            <Submit className="btn btn-primary" pending="Apagando…">Apagar tudo</Submit>
          </ActionForm>
        </details>
      </Section>
    </div>
  );
}

function PersonSelect({ id, name, label, people }: { id: string; name: string; label: string; people: q.Participant[] }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-bold">{label}</label>
      <select id={id} name={name} className="input" required defaultValue="">
        <option value="" disabled>Escolha</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>
    </div>
  );
}

type Step = { title: string; detail: string; done: boolean; href: string; bar?: number };

/** Andamento em quatro etapas, na ordem em que acontecem; a etapa atual leva para a seção onde se age. */
function Progress({ steps }: { steps: Step[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((s, i) => {
        const now = i === current;
        return (
          <li key={s.title}>
            <a href={s.href} aria-current={now ? "step" : undefined}
              className={`flex h-full flex-col gap-1 rounded-xl px-3.5 py-3 ${now ? "bg-sheet ring-2 ring-pine" : s.done ? "bg-pine-soft/60" : "bg-sheet/60 ring-1 ring-line"}`}>
              <span className="flex items-center gap-2">
                <span aria-hidden className={`hand flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.95rem] font-bold ${now ? "bg-pine text-white" : s.done ? "bg-pine text-white" : "bg-paper-deep text-muted"}`}>
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={`font-bold leading-tight ${now || s.done ? "text-pine" : "text-muted"}`}>{s.title}</span>
              </span>
              <span className={`text-[0.95rem] ${now ? "text-ink" : "text-muted"}`}>
                {s.detail}
                <span className="sr-only">{s.done ? " (concluído)" : now ? " (próximo passo)" : ""}</span>
              </span>
              {s.bar !== undefined && (
                <span aria-hidden className="mt-auto block h-1.5 overflow-hidden rounded-full bg-paper-deep">
                  <span className="block h-full rounded-full bg-pine" style={{ width: `${Math.round(s.bar * 100)}%` }} />
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
