"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { joinAction, type JoinState } from "@/app/actions/participant";
import { PendingProvider, readValues, Submit, writeValues } from "@/components/ActionForm";
import { Field, fieldProps, Notice } from "@/components/ui";
import { saveLink } from "@/lib/saved";

export function JoinForm({ code, groupName, whatsapp }: { code: string; groupName: string; whatsapp: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction, {});
  const e = state.fieldErrors ?? {};

  const form = useRef<HTMLFormElement>(null);
  const snap = useRef<ReturnType<typeof readValues> | null>(null);

  useEffect(() => {
    if (state.at && !state.ok && form.current && snap.current) writeValues(form.current, snap.current);
    if (state.at && !state.ok) {
      const first = Object.keys(state.fieldErrors ?? {})[0];
      if (first) document.getElementById(first)?.focus();
    }
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
      <p className="font-bold">Seu contato <span className="font-normal text-muted">(pelo menos um: e-mail ou WhatsApp)</span></p>
      <Field id="email" label="Seu e-mail" error={e.email} hint="Para receber seu link e o aviso do sorteio. Com ele, você recupera o link em “Perdi meu link” se perder.">
        <input {...fieldProps("email", e.email, true)} name="email" className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} />
      </Field>
      <Field id="phone" label="Seu WhatsApp" error={e.phone}
        hint={whatsapp ? "Para receber seu link, o aviso do sorteio e o lembrete na véspera." : "Para o organizador falar com você, se precisar."}>
        <input {...fieldProps("phone", e.phone, true)} name="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" id="consent" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-pine)]"
          aria-invalid={e.consent ? true : undefined} aria-describedby={e.consent ? "consent-error" : undefined} />
        <span>
          Li <Link href="/duvidas#privacidade" target="_blank" className="link">como os dados são usados<span className="sr-only"> (abre em nova aba)</span></Link>: só para esta brincadeira, apagados depois da festa.
          {e.consent && <span id="consent-error" className="block font-semibold text-cherry">{e.consent}</span>}
        </span>
      </label>
      {state.at && !state.ok && state.error && <Notice tone="error">{state.error}</Notice>}
      <Submit className="btn btn-primary w-full" pending="Entrando…">Entrar no grupo</Submit>
    </form>
    </PendingProvider>
  );
}
