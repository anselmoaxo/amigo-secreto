import type { Metadata } from "next";
import Link from "next/link";
import { recoverAction } from "@/app/actions/recover";
import { ActionForm, Submit, TextField } from "@/components/ActionForm";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Perdi meu link", robots: { index: false } };

export default async function Recover({ searchParams }: { searchParams: Promise<{ antigo?: string }> }) {
  const { antigo } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      {antigo && (
        <Notice tone="info" title="O site mudou: agora não precisa mais de login.">
          Cada pessoa tem um link próprio. Digite o e-mail que você usava para receber os links dos seus grupos.
        </Notice>
      )}
      <div>
        <h1 className="text-3xl font-extrabold text-pine">Perdi meu link</h1>
        <p className="mt-1 text-muted">
          Mandamos para o seu e-mail os links de todos os grupos em que ele foi cadastrado, como organizador ou participante.
        </p>
        <p className="mt-2 text-muted">
          Por segurança, a resposta é sempre a mesma, tenha ou não grupos com esse e-mail. Se nada chegar em alguns minutos, confira o spam
          e tente de novo; se ainda assim não chegar, provavelmente outro e-mail foi usado.
        </p>
      </div>
      <ActionForm action={recoverAction} className="sheet space-y-4 p-5 sm:p-7">
        <TextField name="email" id="r-email" label="Seu e-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} required />
        <Submit className="btn btn-pine w-full sm:w-auto" pending="Enviando…">Enviar meus links</Submit>
      </ActionForm>
      <div className="space-y-1 text-muted">
        <p>Não cadastrou e-mail? Peça ao organizador para reenviar seu link pelo painel dele.</p>
        <p>É o organizador e não cadastrou e-mail? O painel só pode ser aberto pelo link guardado, em <Link href="/meus-grupos" className="link">Meus grupos</Link> no aparelho onde você criou o grupo.</p>
      </div>
    </div>
  );
}
