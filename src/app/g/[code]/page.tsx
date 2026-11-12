import type { Metadata } from "next";
import Link from "next/link";
import { GroupTag } from "@/components/GroupTag";
import { Notice } from "@/components/ui";
import { whatsappServerEnabled } from "@/lib/notify";
import * as q from "@/lib/queries";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await q.getInvite(code);

  if (!invite) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-12">
        <h1 className="text-3xl font-extrabold text-pine">Convite não encontrado</h1>
        <p>O link pode estar incompleto, ou o grupo foi encerrado pelo organizador. Peça o link de novo para quem te convidou.</p>
        <Link href="/" className="btn btn-ghost">Ir para o início</Link>
      </div>
    );
  }

  const closed = q.inviteClosedReason(invite);
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <p className="text-lg">{invite.organizer_name ? <><strong>{invite.organizer_name}</strong> te convidou para o amigo secreto</> : "Você foi convidado para o amigo secreto"}</p>
      <GroupTag group={invite}>
        <p className="mt-3 text-[0.95rem] text-muted">{invite.members} {invite.members === 1 ? "pessoa no grupo" : "pessoas no grupo"}</p>
      </GroupTag>
      {invite.organizer_can_see_pairs && <Notice tone="warn">Neste grupo, o organizador escolheu poder ver todos os pares do sorteio.</Notice>}

      {closed ? (
        <Notice tone="warn" title="Não dá mais para entrar por este convite.">
          {closed} Se você já entrou, abra o link pessoal que recebeu ou <Link href="/recuperar" className="link">receba seus links por e-mail</Link>.
        </Notice>
      ) : (
        <div className="sheet p-5 sm:p-7">
          <h2 className="text-xl font-bold text-pine">Entrar no grupo</h2>
          <p className="mt-1 text-muted">Você recebe um link pessoal, só seu, para ver quem tirou. Não precisa criar conta.</p>
          <JoinForm code={code} groupName={invite.name} whatsapp={whatsappServerEnabled()} />
          <p className="mt-5 text-[0.95rem] text-muted">
            Já entrou antes? Abra <Link href="/meus-grupos" className="link">Meus grupos</Link> ou <Link href="/recuperar" className="link">receba seus links por e-mail</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
