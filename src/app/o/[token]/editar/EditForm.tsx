"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateGroupAction } from "@/app/actions/organizer";
import { Spinner } from "@/components/ActionForm";
import { BasicsFields, EventFields, RuleFields } from "@/components/GroupFields";
import { Notice } from "@/components/ui";
import type { Errors, GroupInput } from "@/lib/validation";

export function EditForm({ token, initial, drawn }: { token: string; initial: GroupInput; drawn: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof GroupInput>(k: K, val: GroupInput[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        const res = await updateGroupAction(token, v);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          setError(res.error);
          const first = Object.keys(res.fieldErrors ?? {})[0];
          if (first) document.getElementById(first)?.focus();
          return;
        }
        router.push(`/o/${token}`);
        router.refresh();
      } catch {
        setError("Sem conexão com o servidor. Confira sua internet e tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={save} noValidate className="space-y-8">
      <div>
        <Link href={`/o/${token}`} className="link">Voltar ao painel</Link>
        <h1 className="mt-3 text-3xl font-extrabold text-pine">Editar grupo</h1>
        {drawn && <p className="mt-1 text-muted">O sorteio já foi feito. Mudanças de data, local e recado aparecem para todos; o resultado não muda.</p>}
      </div>
      <fieldset className="sheet space-y-4 p-5 sm:p-7">
        <legend className="sr-only">O grupo</legend>
        <h2 className="text-xl font-bold text-pine">O grupo</h2>
        <BasicsFields value={v} errors={errors} set={set} editing />
      </fieldset>
      <fieldset className="sheet space-y-4 p-5 sm:p-7">
        <legend className="sr-only">O encontro</legend>
        <h2 className="text-xl font-bold text-pine">O encontro</h2>
        <EventFields value={v} errors={errors} set={set} />
      </fieldset>
      <fieldset className="sheet space-y-4 p-5 sm:p-7">
        <legend className="sr-only">Regras</legend>
        <h2 className="text-xl font-bold text-pine">Regras</h2>
        <RuleFields value={v} errors={errors} set={set} canEnablePairs={initial.organizerCanSeePairs} />
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link href={`/o/${token}`} className="btn btn-ghost">Cancelar</Link>
        <button className="btn btn-pine" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <><Spinner />Salvando…</> : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
