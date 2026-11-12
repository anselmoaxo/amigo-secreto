"use client";

import { useActionState, useState, useTransition } from "react";
import { drawAction, pairsAction, resetDrawAction, type DrawState, type PairsResult } from "@/app/actions/organizer";
import { ActionForm, PendingProvider, Spinner, Submit } from "@/components/ActionForm";
import { Notice } from "@/components/ui";
import type { NamedProblem } from "@/lib/queries";

const list = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

/** Explica em português por que o sorteio não fecha e o que fazer. */
export function ProblemText({ problem }: { problem: NamedProblem }) {
  switch (problem.kind) {
    case "too-few":
      return (
        <>
          <p className="font-bold">Faltam pessoas.</p>
          <p>O sorteio precisa de pelo menos {problem.min} participantes; agora {problem.count === 1 ? "há 1" : `há ${problem.count}`}. Convide mais gente.</p>
        </>
      );
    case "giver-blocked":
      return (
        <>
          <p className="font-bold">{list(problem.people)} não {problem.people.length === 1 ? "pode" : "podem"} tirar ninguém.</p>
          <p>As regras e os núcleos bloqueiam todas as opções. Remova alguma regra que envolva {problem.people.length === 1 ? "essa pessoa" : "essas pessoas"}.</p>
        </>
      );
    case "receiver-blocked":
      return (
        <>
          <p className="font-bold">Ninguém pode tirar {list(problem.people)}.</p>
          <p>Todas as outras pessoas estão proibidas de tirar {problem.people.length === 1 ? "essa pessoa" : "essas pessoas"}. Remova alguma regra.</p>
        </>
      );
    case "bottleneck":
      return (
        <>
          <p className="font-bold">
            {list(problem.givers)} só {problem.givers.length === 1 ? "pode" : "podem"} tirar {list(problem.receivers)}.
          </p>
          <p>
            São {problem.givers.length} pessoas para {problem.receivers.length} {problem.receivers.length === 1 ? "opção" : "opções"}, então alguém ficaria sem par.
            Costuma acontecer quando um núcleo tem mais da metade do grupo. Divida o núcleo, remova regras ou convide mais gente.
          </p>
        </>
      );
  }
}

export function DrawPanel({
  t, drawn, revealed, total, problem, canSeePairs,
}: { t: string; drawn: boolean; revealed: number; total: number; problem: NamedProblem | null; canSeePairs: boolean }) {
  const [state, action, pending] = useActionState<DrawState, FormData>(drawAction, {});
  const [redo, setRedo] = useState(false);
  const [force, setForce] = useState(false);
  const shownProblem = state.problem ?? (!drawn ? problem : null);

  if (!drawn) {
    return (
      <PendingProvider value={pending}>
      <div className="space-y-4">
        {shownProblem ? (
          <Notice tone="warn"><ProblemText problem={shownProblem} /></Notice>
        ) : (
          <p>Tudo certo para sortear {total} pessoas. Cada uma recebe o aviso no próprio link, por e-mail ou WhatsApp quando houver.</p>
        )}
        <form action={action} className="space-y-3">
          <input type="hidden" name="t" value={t} />
          <Submit className="btn btn-primary w-full sm:w-auto" pending="Sorteando…" disabled={Boolean(problem)}>Fazer o sorteio</Submit>
          {state.at && !state.ok && !state.problem && state.error && <Notice tone="error">{state.error}</Notice>}
        </form>
      </div>
      </PendingProvider>
    );
  }

  return (
    <PendingProvider value={pending}>
    <div className="space-y-5">
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <p>
        Sorteio feito. <strong>{revealed} de {total}</strong> {total === 1 ? "pessoa já viu" : "pessoas já viram"} quem tirou.
        Nem você vê os pares{canSeePairs ? ", a não ser que abra a lista abaixo" : ""}.
      </p>

      {canSeePairs && <PairsViewer t={t} />}

      <div className="space-y-3 border-t border-line pt-4">
        {!redo ? (
          <button type="button" className="link" onClick={() => setRedo(true)}>Refazer ou desfazer o sorteio</button>
        ) : (
          <div className="space-y-4">
            {revealed === 0 ? (
              <form action={action} className="space-y-2">
                <input type="hidden" name="t" value={t} />
                <input type="hidden" name="mode" value="redraw" />
                <p>Ninguém viu o resultado ainda, então dá para sortear de novo sem problema. Todos recebem o aviso de novo.</p>
                <Submit className="btn btn-primary btn-sm" pending="Sorteando…">Sortear de novo</Submit>
              </form>
            ) : (
              <form action={action} className="space-y-3 rounded-xl bg-cherry-soft p-4">
                <input type="hidden" name="t" value={t} />
                <input type="hidden" name="mode" value="redraw" />
                <p className="font-bold">{revealed} {revealed === 1 ? "pessoa já viu" : "pessoas já viram"} quem tirou.</p>
                <p>Se sortear de novo, todos recebem um resultado novo e quem já viu precisa esquecer o anterior. Pode gerar confusão, e alguém pode já ter comprado o presente.</p>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="force" className="mt-1 h-5 w-5 accent-[var(--color-cherry)]" checked={force} onChange={(e) => setForce(e.target.checked)} />
                  <span>Entendo e quero sortear de novo mesmo assim</span>
                </label>
                <Submit className="btn btn-primary btn-sm" pending="Sorteando…" disabled={!force}>Sortear de novo</Submit>
              </form>
            )}
            {state.at && !state.ok && state.error && (
              <Notice tone="error">{state.problem ? <ProblemText problem={state.problem} /> : state.error}</Notice>
            )}

            <ActionForm action={resetDrawAction} hidden={{ t }} className="space-y-2 border-t border-line pt-4">
              <p>
                Precisa incluir ou tirar alguém? <strong>Desfazer o sorteio</strong> apaga o resultado e reabre o grupo. Depois você sorteia de novo.
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name="confirm" className="mt-1 h-5 w-5 accent-[var(--color-cherry)]" />
                <span>Entendo que o resultado atual será apagado</span>
              </label>
              <Submit className="btn btn-ghost btn-sm" pending="Desfazendo…">Desfazer o sorteio</Submit>
            </ActionForm>
            <button type="button" className="link" onClick={() => setRedo(false)}>Fechar</button>
          </div>
        )}
      </div>
    </div>
    </PendingProvider>
  );
}

function PairsViewer({ t }: { t: string }) {
  const [res, setRes] = useState<PairsResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) {
    return (
      <div className="space-y-2 rounded-xl border border-gold/50 bg-gold-soft/60 p-4">
        <p className="font-bold">Todos os pares</p>
        <ul className="space-y-1">
          {res.pairs.map((p) => <li key={p.giver}>{p.giver} tirou <strong>{p.receiver}</strong></li>)}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRes(null)}>Esconder pares</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending}
        onClick={() => start(async () => setRes(await pairsAction(t).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }))))}>
        {pending ? <><Spinner />Carregando…</> : "Ver todos os pares"}
      </button>
      <p className="text-[0.95rem] text-muted">Você escolheu ter esse acesso ao criar o grupo. Abra só se precisar.</p>
      {res && !res.ok && <Notice tone="error">{res.error}</Notice>}
    </div>
  );
}
