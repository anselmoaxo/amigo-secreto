"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { joinAction, type JoinState } from "@/app/actions/participant";
import { PendingProvider, readValues, Submit, writeValues } from "@/components/ActionForm";
import { Field, fieldProps, Notice } from "@/components/ui";
import { saveLink } from "@/lib/saved";

export function JoinForm({ code, groupName }: { code: string; groupName: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction, {});
  const e = state.fieldErrors ?? {};

  const form = useRef<HTMLFormElement>(null);
  const snap = useRef<ReturnType<typeof readValues> | null>(null);

  useEffect(() => {
    if (state.at && !state.ok && form.current && snap.current) writeValues(form.current, snap.current);
    if (state.ok && state.token) {
      saveLink({ kind: "participant", token: state.token, group: groupName });
      router.push(`/p/${state.token}?bemvindo=1`);
    }
  }, [state, router, groupName]);

  return (
    <PendingProvider value={pending}>
    <form ref={form} action={action} onSubmit={(ev) => { snap.current = readValues(ev.currentTarget); }} noValidate className="mt-5 space-y-5">
      <input type="hidden" name="code" value={code} />
      <Field id="name" label="Seu nome" error={e.name} hint="Como as pessoas te conhecem. Se houver alguém com o mesmo nome, use o sobrenome.">
        <input {...fieldProps("name", e.name, true)} name="name" className="input" maxLength={60} autoComplete="name" required />
      </Field>
      <Field id="email" label="Seu e-mail" optional error={e.email} hint="Para receber seu link e o aviso do sorteio.">
        <input {...fieldProps("email", e.email, true)} name="email" className="input" type="email" inputMode="email" autoComplete="email" />
      </Field>
      <Field id="phone" label="Seu WhatsApp" optional error={e.phone}>
        <input {...fieldProps("phone", e.phone)} name="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-[var(--color-pine)]" aria-describedby={e.consent ? "consent-error" : undefined} />
        <span>
          Li <Link href="/duvidas#privacidade" target="_blank" className="link">como os dados são usados</Link>: só para esta brincadeira, apagados depois da festa.
          {e.consent && <span id="consent-error" className="block font-semibold text-cherry">{e.consent}</span>}
        </span>
      </label>
      {state.at && !state.ok && state.error && <Notice tone="error">{state.error}</Notice>}
      <Submit className="btn btn-primary w-full" pending="Entrando…">Entrar no grupo</Submit>
    </form>
    </PendingProvider>
  );
}
