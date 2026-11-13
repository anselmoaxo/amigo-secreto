"use client";

import { useState, useTransition } from "react";
import { editPersonAction, personalLinkAction, removePersonAction, resendInviteAction, type LinkResult } from "@/app/actions/organizer";
import { ActionForm, Spinner, Submit, TextField } from "@/components/ActionForm";
import { CopyButton, whatsappUrl } from "@/components/Share";
import { Notice } from "@/components/ui";
import { formatPhone } from "@/lib/format";

export type Row = {
  id: string; name: string; email: string | null; phone: string | null; team: string | null;
  status: "pending" | "confirmed" | "declined"; isOrganizer: boolean; revealed: boolean; inviteSent: boolean;
};

const STATUS = {
  confirmed: { label: "Confirmou", cls: "bg-pine-soft text-pine-dark" },
  pending: { label: "Não respondeu", cls: "bg-gold-soft text-gold-ink" },
  declined: { label: "Não vai participar", cls: "bg-paper-deep text-muted" },
} as const;

export function PersonRow({ t, p, drawn, canChange }: { t: string; p: Row; drawn: boolean; canChange: boolean }) {
  const [mode, setMode] = useState<"none" | "send" | "edit" | "remove">("none");
  const toggle = (m: typeof mode) => setMode((x) => (x === m ? "none" : m));
  const s = STATUS[p.status];

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {p.name}
            {p.isOrganizer && <span className="ml-2 font-normal text-muted">(você)</span>}
          </p>
          <p className="text-[0.95rem] text-muted">
            {[p.email, p.phone && formatPhone(p.phone), p.team && `Núcleo: ${p.team}`].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[0.9rem] font-semibold ${s.cls}`}>{s.label}</span>
          {drawn && p.status !== "declined" && (
            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[0.9rem] font-semibold ${p.revealed ? "bg-pine text-white" : "bg-paper-deep text-muted"}`}>
              {p.revealed ? "Já viu quem tirou" : "Ainda não viu"}
            </span>
          )}
        </div>
      </div>

      {(!p.isOrganizer || !drawn) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {!p.isOrganizer && (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={mode === "send"} onClick={() => toggle("send")}>
              {p.inviteSent ? "Reenviar link" : "Enviar link"}
            </button>
          )}
          {!drawn && (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={mode === "edit"} onClick={() => toggle("edit")}>Editar</button>
          )}
          {!drawn && canChange && !p.isOrganizer && (
            <button type="button" className="btn btn-sm text-cherry hover:bg-cherry-soft" aria-expanded={mode === "remove"} onClick={() => toggle("remove")}>Remover</button>
          )}
        </div>
      )}

      {mode === "send" && <SendPanel t={t} p={p} />}
      {mode === "edit" && (
        <ActionForm action={editPersonAction} hidden={{ t, id: p.id }} className="mt-3 space-y-3 rounded-xl bg-paper p-4" onSuccess={() => setMode("none")}>
          <TextField name="name" id={`e-${p.id}-name`} label="Nome" defaultValue={p.name} maxLength={60} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-[0.95rem] text-muted sm:col-span-2">Pelo menos um contato: e-mail ou WhatsApp.</p>
            <TextField name="email" id={`e-${p.id}-email`} label="E-mail" type="email" autoCapitalize="off" spellCheck={false} defaultValue={p.email ?? ""} />
            <TextField name="phone" id={`e-${p.id}-phone`} label="WhatsApp" type="tel" defaultValue={p.phone ? formatPhone(p.phone) : ""} />
          </div>
          <TextField name="team" id={`e-${p.id}-team`} label="Núcleo" optional hint="Quem tem o mesmo núcleo não se tira." defaultValue={p.team ?? ""} maxLength={40} list="nucleos" />
          <div className="flex gap-2">
            <Submit className="btn btn-pine btn-sm">Salvar</Submit>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("none")}>Cancelar</button>
          </div>
        </ActionForm>
      )}
      {mode === "remove" && (
        <ActionForm action={removePersonAction} hidden={{ t, id: p.id }} className="mt-3 space-y-3 rounded-xl bg-cherry-soft p-4">
          <p>Remover <strong>{p.name}</strong> do grupo? O link dessa pessoa para de funcionar e a lista de desejos dela é apagada.</p>
          <div className="flex gap-2">
            <Submit className="btn btn-primary btn-sm" pending="Removendo…">Remover</Submit>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("none")}>Cancelar</button>
          </div>
        </ActionForm>
      )}
    </li>
  );
}

function SendPanel({ t, p }: { t: string; p: Row }) {
  const [link, setLink] = useState<LinkResult | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pending, start] = useTransition();
  const load = (regenerate: boolean) =>
    start(async () => {
      try {
        setLink(await personalLinkAction(t, p.id, regenerate));
        setConfirmNew(false);
      } catch {
        setLink({ ok: false, error: "Sem conexão. Confira sua internet e tente de novo." });
      }
    });

  return (
    <div className="mt-3 space-y-4 rounded-xl bg-paper p-4">
      <p className="text-[0.95rem] text-muted">
        O link é pessoal: quem abrir vê o resultado de {p.name}. Mande só para essa pessoa.
      </p>

      {p.email && (
        <ActionForm action={resendInviteAction} hidden={{ t, id: p.id }} className="space-y-2">
          <Submit className="btn btn-pine btn-sm" pending="Enviando…">Enviar por e-mail para {p.email}</Submit>
        </ActionForm>
      )}

      {!link?.ok ? (
        <div className="space-y-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(false)} disabled={pending} aria-busy={pending || undefined}>
            {pending ? <><Spinner />Preparando…</> : "Preparar mensagem para WhatsApp"}
          </button>
          {link && !link.ok && <Notice tone="error">{link.error}</Notice>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-whats btn-sm" target="_blank" rel="noreferrer" href={whatsappUrl(link.text, link.phone)}>
              {link.phone ? `Abrir conversa com ${p.name}` : "Escolher contato no WhatsApp"}
            </a>
            <CopyButton text={link.text} label="Copiar mensagem" done="Mensagem copiada" />
            <CopyButton text={link.url} label="Copiar só o link" done="Link copiado" />
          </div>
        </div>
      )}

      <div className="border-t border-line pt-3">
        {!confirmNew ? (
          <button type="button" className="link text-[0.95rem]" onClick={() => setConfirmNew(true)}>
            Gerar um link novo para {p.name}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[0.95rem]">O link antigo para de funcionar. Use se o link foi parar com a pessoa errada.</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => load(true)} disabled={pending}>Gerar link novo</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmNew(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
