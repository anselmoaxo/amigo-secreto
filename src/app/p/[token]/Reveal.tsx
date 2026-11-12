"use client";

import { useRef, useState } from "react";
import { revealAction, type RevealResult } from "@/app/actions/participant";
import { Spinner } from "@/components/ActionForm";
import { Notice } from "@/components/ui";

type Step = "closed" | "confirm" | "loading" | "open";

/**
 * Revelação em duas etapas: a pessoa confirma que está sozinha,
 * só então o nome é buscado no servidor e o papel desdobra.
 */
export function Reveal({ token, wishlist }: { token: string; wishlist: boolean }) {
  const [step, setStep] = useState<Step>("closed");
  const [res, setRes] = useState<RevealResult | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const focusArea = () => setTimeout(() => area.current?.focus(), 0);

  async function show() {
    setStep("loading");
    try {
      const r = await revealAction(token);
      setRes(r);
      setStep(r.ok ? "open" : "confirm");
    } catch {
      setRes({ ok: false, error: "Sem conexão. Confira sua internet e tente de novo." });
      setStep("confirm");
    }
    focusArea();
  }

  function hide() {
    setRes(null); // tira o nome da memória da página também
    setStep("closed");
    focusArea();
  }

  return (
    <div ref={area} tabIndex={-1} className="outline-none" aria-live="polite">
      {step === "closed" && (
        <div className="slip flex flex-col items-center gap-4 px-6 py-10 text-center">
          <p className="hand text-2xl font-bold text-pine">O sorteio saiu!</p>
          <p className="max-w-[30ch] text-muted">Seu papelzinho está dobrado. Abra quando estiver num lugar reservado.</p>
          <button type="button" className="btn btn-primary text-lg" onClick={() => { setStep("confirm"); focusArea(); }}>
            Ver quem eu tirei
          </button>
        </div>
      )}

      {(step === "confirm" || step === "loading") && (
        <div className="slip space-y-4 px-6 py-8 text-center">
          <p className="text-xl font-bold text-pine">Só você está vendo a tela?</p>
          <p className="mx-auto max-w-[34ch] text-muted">O nome vai aparecer grande. Confira se ninguém está do seu lado ou olhando o seu celular.</p>
          {res && !res.ok && <Notice tone="error" className="text-left">{res.error}</Notice>}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary" onClick={show} disabled={step === "loading"} aria-busy={step === "loading" || undefined}>
              {step === "loading" ? <><Spinner />Abrindo…</> : "Sim, mostrar agora"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={hide} disabled={step === "loading"}>Agora não</button>
          </div>
        </div>
      )}

      {step === "open" && res?.ok && (
        <div className="space-y-4">
          <div className="slip unfold px-6 pb-6 pt-8 text-center">
            <p className="text-muted">Você tirou</p>
            <p className="hand break-words text-6xl font-bold leading-tight text-cherry sm:text-7xl">{res.name}</p>
            <p className="mt-2 text-[0.95rem] text-muted">É segredo! Não conte para ninguém.</p>

            {wishlist && (
              <div className="mt-6 border-t border-dashed border-line pt-5 text-left">
                <h3 className="font-bold text-pine">O que {res.name} gostaria de ganhar</h3>
                {res.preferences && <p className="mt-2 whitespace-pre-line">{res.preferences}</p>}
                {res.wishes.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {res.wishes.map((w) => (
                      <li key={w.id} className="flex gap-2">
                        <span aria-hidden className="text-gold">✦</span>
                        {w.link ? <a href={w.link} target="_blank" rel="noreferrer nofollow" className="link">{w.description}</a> : <span>{w.description}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !res.preferences && <p className="mt-2 text-muted">{res.name} ainda não escreveu nada. Volte mais perto da festa.</p>
                )}
              </div>
            )}
          </div>
          {res.otherDevice && (
            <Notice tone="warn">
              Este papelzinho já tinha sido aberto em outro aparelho
              {res.firstSeenAt ? ` em ${new Date(res.firstSeenAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : ""}.
              Se não foi você em outro celular ou computador, alguém com o seu link pode ter visto o resultado. Avise o organizador.
            </Notice>
          )}
          {res.firstSeenAt && !res.otherDevice && (
            <p className="text-[0.95rem] text-muted">
              Este resultado foi aberto pela primeira vez em{" "}
              {new Date(res.firstSeenAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}.
              Se não foi você, avise o organizador.
            </p>
          )}
          <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={hide}>Esconder de novo</button>
        </div>
      )}
    </div>
  );
}
