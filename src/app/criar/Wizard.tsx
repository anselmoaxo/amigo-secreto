"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createGroupAction } from "@/app/actions/create";
import { BasicsFields, EventFields, RuleFields } from "@/components/GroupFields";
import { Spinner } from "@/components/ActionForm";
import { Field, fieldProps, Notice } from "@/components/ui";
import { formatDate, formatPhone, priceRange } from "@/lib/format";
import { saveLink } from "@/lib/saved";
import {
  emptyGroup, normalizePhone, occasionLabel, parseMoney, STEP_FIELDS, validateGroup, validatePerson,
  type Errors, type GroupInput, type PersonInput,
} from "@/lib/validation";

const STEPS = [
  {
    key: "basics", short: "Grupo", title: "O grupo",
    intro: "Comece pelo básico. Até o sorteio, dá para ajustar quase tudo. Depois dele, data, local e recado continuam editáveis, mas para mudar pessoas ou regras é preciso refazer o sorteio.",
  },
  { key: "event", short: "Encontro", title: "O encontro", intro: "Tudo aqui é opcional. Preencha o que já souber." },
  { key: "people", short: "Pessoas", title: "Participantes", intro: "Adicione quem vai participar ou convide depois pelo link do grupo." },
  { key: "rules", short: "Regras", title: "Regras", intro: "Como o grupo funciona até o sorteio." },
  { key: "review", short: "Revisão", title: "Revisar e criar", intro: "Confira tudo antes de criar. Use “Alterar” para voltar a qualquer etapa sem perder o que já preencheu." },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
const stepIndex = (k: StepKey) => STEPS.findIndex((s) => s.key === k);
/** Em qual etapa fica cada campo (para levar a pessoa ao erro que veio do servidor). */
const stepOfField = (field: string) => {
  for (const [k, fields] of Object.entries(STEP_FIELDS)) if ((fields as readonly string[]).includes(field)) return stepIndex(k as StepKey);
  return 0;
};

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const STORAGE = "amigo-secreto:rascunho";
const emptyPerson: PersonInput = { name: "", email: "", phone: "", team: "" };

type Draft = { step: number; group: GroupInput; people: PersonInput[]; sendInvites: boolean };

export function Wizard({ whatsapp, email }: { whatsapp: boolean; email: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ step: 0, group: emptyGroup, people: [], sendInvites: true });
  const [errors, setErrors] = useState<Errors>({});
  const [personErrors, setPersonErrors] = useState<Record<number, Errors>>({});
  const [formError, setFormError] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, start] = useTransition();
  const [restored, setRestored] = useState(false);
  const [created, setCreated] = useState(false);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Recupera o rascunho (recarregar a página não perde nada).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE) ?? "null");
      if (saved?.group) setDraft({ ...saved, group: { ...emptyGroup, ...saved.group } });
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(STORAGE, JSON.stringify(draft)); } catch {}
  }, [draft, restored]);

  // Ao trocar de etapa, o foco vai para o título (leitores de tela anunciam a etapa).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [draft.step]);

  const { step, group, people } = draft;
  const current = STEPS[step];
  const set = <K extends keyof GroupInput>(k: K, v: GroupInput[K]) => {
    setDraft((d) => ({ ...d, group: { ...d.group, [k]: v } }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError("");
  };

  function stepErrors(i: number): Errors {
    const key = STEPS[i].key;
    if (key === "people" || key === "review") return {};
    const all = validateGroup(group, { isNew: true });
    return Object.fromEntries(Object.entries(all).filter(([k]) => (STEP_FIELDS[key] as readonly string[]).includes(k)));
  }

  function validatePeople() {
    const pe: Record<number, Errors> = {};
    people.forEach((p, i) => {
      const e = validatePerson(p);
      if (Object.keys(e).length) pe[i] = e;
    });
    const names = [...(group.organizerJoins ? [group.organizerName] : []), ...people.map((p) => p.name)].map((n) => n.trim().toLowerCase());
    people.forEach((p, i) => {
      const n = p.name.trim().toLowerCase();
      if (n && names.indexOf(n) !== names.lastIndexOf(n)) pe[i] = { ...pe[i], name: "Nome repetido. Use também o sobrenome." };
    });
    setPersonErrors(pe);
    const first = Object.keys(pe)[0];
    if (first !== undefined) {
      const field = Object.keys(pe[Number(first)])[0];
      setTimeout(() => document.getElementById(`p-${first}-${field}`)?.focus(), 0);
    }
    return Object.keys(pe).length === 0;
  }

  function next() {
    setFormError("");
    if (current.key === "people") {
      if (!validatePeople()) return setFormError("Confira os nomes destacados.");
    } else {
      const e = stepErrors(step);
      setErrors(e);
      if (Object.keys(e).length) {
        setFormError("Confira os campos destacados.");
        const first = Object.keys(e)[0];
        setTimeout(() => document.getElementById(first)?.focus(), 0);
        return;
      }
    }
    setDraft((d) => ({ ...d, step: Math.min(d.step + 1, STEPS.length - 1) }));
  }

  function back() {
    goTo(step - 1);
  }

  /** Voltar (ou ir pela revisão) nunca apaga o que foi preenchido. */
  function goTo(i: number) {
    setFormError("");
    setDraft((d) => ({ ...d, step: Math.min(Math.max(i, 0), STEPS.length - 1) }));
  }

  const total = people.length + (group.organizerJoins ? 1 : 0);
  const needPeopleNow = !group.allowChanges && total < 3;

  function submit() {
    // Evita criar o grupo duas vezes com clique duplo ou Enter repetido.
    if (submitting.current || created) return;
    setFormError("");
    if (!consent) {
      setFormError("Marque a caixa confirmando que leu como os dados são usados.");
      setTimeout(() => document.getElementById("consent")?.focus(), 0);
      return;
    }
    if (needPeopleNow) return setFormError("Com a lista fechada, o grupo precisa de pelo menos 3 pessoas. Adicione participantes ou permita entrar depois.");
    submitting.current = true;
    start(async () => {
      try {
        const res = await createGroupAction({ group, people, sendInvites: draft.sendInvites });
        if (!res.ok) {
          submitting.current = false;
          const fe = res.fieldErrors ?? {};
          const pe = res.personErrors ?? {};
          setErrors(fe);
          setPersonErrors(pe);
          // Leva a pessoa até a etapa com o problema, com o foco no campo.
          const firstField = Object.keys(fe)[0];
          const firstPerson = Object.keys(pe)[0];
          if (firstField || firstPerson !== undefined) {
            const target = firstField ? stepOfField(firstField) : stepIndex("people");
            setDraft((d) => ({ ...d, step: target }));
            setFormError(`${res.error} O problema está na etapa “${STEPS[target].short}”.`);
            const id = firstField ?? `p-${firstPerson}-${Object.keys(pe[Number(firstPerson)])[0]}`;
            setTimeout(() => document.getElementById(id)?.focus(), 50);
          } else {
            setFormError(res.error);
          }
          return;
        }
        setCreated(true);
        saveLink({ kind: "admin", token: res.adminToken, group: res.groupName });
        if (res.myToken) saveLink({ kind: "participant", token: res.myToken, group: res.groupName, person: group.organizerName });
        try { sessionStorage.removeItem(STORAGE); } catch {}
        router.push(`/o/${res.adminToken}?novo=1`);
      } catch {
        submitting.current = false;
        setFormError("Não conseguimos falar com o servidor. Confira sua internet e toque em “Criar grupo” de novo; seus dados continuam aqui.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} goTo={goTo} />

      <div>
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold text-pine outline-none">{current.title}</h1>
        <p className="mt-1 text-muted">{current.intro}</p>
      </div>

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (current.key === "review") submit(); else next(); }}
        className="space-y-6"
      >
        <div className="sheet p-5 sm:p-7">
          {current.key === "basics" && <BasicsFields value={group} errors={errors} set={set} whatsapp={whatsapp} />}
          {current.key === "event" && <EventFields value={group} errors={errors} set={set} />}
          {current.key === "people" && (
            <PeopleStep
              people={people} errors={personErrors} organizer={group.organizerJoins ? group.organizerName : null}
              onChange={(p) => { setDraft((d) => ({ ...d, people: p })); setPersonErrors({}); setFormError(""); }}
              allowChanges={group.allowChanges} whatsapp={whatsapp}
            />
          )}
          {current.key === "rules" && <RuleFields value={group} errors={errors} set={set} />}
          {current.key === "review" && (
            <Review draft={draft} goTo={goTo} whatsapp={whatsapp} email={email}
              setSend={(v) => setDraft((d) => ({ ...d, sendInvites: v }))} consent={consent} setConsent={(v) => { setConsent(v); setFormError(""); }} />
          )}
        </div>

        {formError && <Notice tone="error">{formError}</Notice>}
        {created && <Notice tone="success" title="Grupo criado!">Abrindo o seu painel…</Notice>}
        {current.key === "review" && needPeopleNow && !formError && (
          <Notice tone="warn">Com a lista fechada, o grupo precisa de pelo menos 3 pessoas. Volte em Participantes ou em Regras.</Notice>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-ghost" disabled={pending || created}>Voltar</button>
          ) : (
            <Link href="/" className="btn btn-ghost">Cancelar</Link>
          )}
          {current.key === "review" ? (
            <button type="submit" className="btn btn-primary" disabled={pending || created} aria-busy={pending || created || undefined}>
              {pending || created ? <><Spinner />{created ? "Abrindo o painel…" : "Criando grupo…"}</> : "Criar grupo"}
            </button>
          ) : (
            <button type="submit" className="btn btn-pine">Continuar para {STEPS[step + 1].short.toLowerCase()}</button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Etapas com nome curto: as já feitas viram botão para voltar (os campos ficam guardados). */
function Stepper({ step, goTo }: { step: number; goTo: (i: number) => void }) {
  return (
    <nav aria-label="Etapas da criação">
      <p className="font-semibold text-muted" aria-live="polite">
        Etapa {step + 1} de {STEPS.length}<span className="sm:hidden">: {STEPS[step].short}</span>
      </p>
      <ol className="mt-2 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < step;
          const here = i === step;
          const bar = <span aria-hidden className={`block h-1.5 rounded-full ${i <= step ? "bg-pine" : "bg-line"}`} />;
          const text = (
            <span aria-hidden className={`mt-1.5 hidden truncate text-[0.85rem] sm:block ${here ? "font-bold text-pine" : done ? "text-pine" : "text-muted"}`}>
              {s.short}
            </span>
          );
          return (
            <li key={s.key} aria-current={here ? "step" : undefined}>
              {done ? (
                <button type="button" onClick={() => goTo(i)} className="block w-full rounded-md pb-1 pt-2 text-left hover:[&>span:last-child]:underline"
                  aria-label={`Voltar para a etapa ${i + 1}, ${s.short} (concluída)`}>
                  {bar}{text}
                </button>
              ) : (
                <div className="pb-1 pt-2">
                  {bar}{text}
                  <span className="sr-only">Etapa {i + 1}, {s.short}{here ? " (atual)" : ""}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PeopleStep({
  people, errors, organizer, onChange, allowChanges, whatsapp,
}: { people: PersonInput[]; errors: Record<number, Errors>; organizer: string | null; onChange: (p: PersonInput[]) => void; allowChanges: boolean; whatsapp: boolean }) {
  const [showTeam, setShowTeam] = useState(people.some((p) => p.team));
  const add = () => {
    onChange([...people, { ...emptyPerson }]);
    setTimeout(() => document.getElementById(`p-${people.length}-name`)?.focus(), 0);
  };
  const update = (i: number, k: keyof PersonInput, v: string) => onChange(people.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const remove = (i: number) => onChange(people.filter((_, j) => j !== i));

  return (
    <div className="space-y-5">
      {organizer && (
        <p className="rounded-xl bg-pine-soft px-4 py-3 text-pine-dark">
          <strong>{organizer || "Você"}</strong> (você) já está na lista.
        </p>
      )}

      {people.length === 0 && (
        <p className="text-muted">
          {allowChanges
            ? "Nenhum participante ainda. Você pode adicionar agora ou depois mandar o convite do grupo no WhatsApp para cada um entrar com o próprio nome."
            : "Nenhum participante ainda. Como a lista vai ficar fechada, adicione todo mundo agora."}
        </p>
      )}

      {people.length > 0 && (
        <p className="text-[0.95rem] text-muted">
          E-mail e WhatsApp são opcionais. {whatsapp
            ? "Com eles, a pessoa recebe o link dela e os avisos do sorteio."
            : "Com o e-mail, a pessoa recebe o link dela e os avisos; o WhatsApp serve para você mandar o link pelo seu celular."}{" "}
          Sem contato, você manda o link pelo painel depois.
        </p>
      )}

      <ol className="space-y-4">
        {people.map((p, i) => {
          const e = errors[i] ?? {};
          return (
            <li key={i} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="hand text-lg font-bold text-gold-ink">
                  <span className="sr-only">Participante </span>{i + 1}
                </span>
                <button type="button" onClick={() => remove(i)} className="btn btn-sm -mr-2 px-3 text-cherry hover:bg-cherry-soft" aria-label={`Remover ${p.name || `participante ${i + 1}`}`}>
                  Remover
                </button>
              </div>
              <div className="mt-1 space-y-3">
                <Field id={`p-${i}-name`} label="Nome" error={e.name}>
                  <input {...fieldProps(`p-${i}-name`, e.name)} className="input" value={p.name} maxLength={60}
                    autoComplete="off" onChange={(x) => update(i, "name", x.target.value)} />
                </Field>
                <div role="group" aria-label={`Contato de ${p.name || `participante ${i + 1}`} (opcional)`} className="grid gap-3 sm:grid-cols-2">
                  <Field id={`p-${i}-email`} label="E-mail" optional error={e.email}>
                    <input {...fieldProps(`p-${i}-email`, e.email)} className="input" type="email" inputMode="email" autoComplete="off" autoCapitalize="off" spellCheck={false}
                      value={p.email} onChange={(x) => update(i, "email", x.target.value)} />
                  </Field>
                  <Field id={`p-${i}-phone`} label="WhatsApp" optional error={e.phone}>
                    <input {...fieldProps(`p-${i}-phone`, e.phone)} className="input" type="tel" inputMode="tel" autoComplete="off"
                      placeholder="(11) 98765-4321" value={p.phone} onChange={(x) => update(i, "phone", x.target.value)} />
                  </Field>
                </div>
                {showTeam && (
                  <Field id={`p-${i}-team`} label="Núcleo" optional error={e.team} hint="Quem tem o mesmo núcleo não se tira. Ex.: Casa da Ana">
                    <input {...fieldProps(`p-${i}-team`, e.team, true)} className="input" value={p.team} maxLength={40}
                      list="nucleos" onChange={(x) => update(i, "team", x.target.value)} />
                  </Field>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <datalist id="nucleos">
        {[...new Set(people.map((p) => p.team.trim()).filter(Boolean))].map((t) => <option key={t} value={t} />)}
      </datalist>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={add} className="btn btn-ghost">Adicionar participante</button>
        {!showTeam && (
          <button type="button" className="link text-left" onClick={() => setShowTeam(true)}>
            Separar casais ou famílias
          </button>
        )}
      </div>
    </div>
  );
}

function Review({
  draft, goTo, setSend, consent, setConsent, whatsapp, email,
}: {
  draft: Draft; goTo: (s: number) => void; setSend: (v: boolean) => void; consent: boolean; setConsent: (v: boolean) => void;
  whatsapp: boolean; email: boolean;
}) {
  const g = draft.group;
  const price = priceRange(parseMoney(g.minValue), parseMoney(g.maxValue));
  const when = [formatDate(g.eventDate || null), g.eventTime].filter(Boolean).join(" às ");
  const total = draft.people.length + (g.organizerJoins ? 1 : 0);
  const names = [...(g.organizerJoins ? [`${g.organizerName} (você)`] : []), ...draft.people.map((p) => p.name.trim())].filter(Boolean);
  // Quem recebe o link agora: e-mail sempre que houver envio de e-mail; WhatsApp só se o envio pelo site estiver ligado.
  const reachable = draft.people.filter((p) => (email && p.email.trim()) || (whatsapp && p.phone.trim())).length;
  const channels = [email && "e-mail", whatsapp && "WhatsApp"].filter(Boolean).join(" ou ");
  const phone = g.organizerJoins && whatsapp && g.organizerPhone ? formatPhone(normalizePhone(g.organizerPhone) ?? g.organizerPhone) : "";

  const rows: [string, React.ReactNode, number][] = [
    ["Grupo", `${g.name} (${occasionLabel(g.occasion)})`, 0],
    ["Organizador", `${g.organizerName}${g.organizerJoins ? ", participa do sorteio" : ", só organiza"}`, 0],
    ["Seus contatos", [g.organizerEmail, phone].filter(Boolean).join(" e ") || "Nenhum", 0],
    ["Quando", when || "Sem data", 1],
    ["Onde", g.location || "Sem local", 1],
    ["Valor", price || "Sem valor definido", 1],
    ["Participantes", (
      <>
        {total} {total === 1 ? "pessoa" : "pessoas"} por enquanto
        {names.length > 0 && <span className="block font-normal text-muted">{names.join(", ")}</span>}
      </>
    ), 2],
    ["Lista de desejos", g.wishlistEnabled ? (g.wishlistUntil ? `Sim, até ${formatDate(g.wishlistUntil)}` : "Sim") : "Não", 3],
    ["Entrar e sair depois", g.allowChanges ? "Permitido até o sorteio" : "Lista fechada", 3],
    ["Ver os pares", g.organizerCanSeePairs ? "Você poderá ver (todos serão avisados)" : "Ninguém vê os pares dos outros", 3],
  ];

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-line">
        {rows.map(([k, v, s]) => (
          <div key={k} className="grid grid-cols-[1fr_auto] gap-x-4 py-3 first:pt-0 sm:grid-cols-[11rem_1fr_auto]">
            <dt className="text-[0.95rem] text-muted sm:text-base">{k}</dt>
            <dd className="col-start-1 row-start-2 min-w-0 break-words font-semibold sm:col-start-2 sm:row-start-1">{v}</dd>
            <dd className="col-start-2 row-span-2 row-start-1 self-center sm:col-start-3">
              <button type="button" className="link inline-flex min-h-11 items-center px-1 text-[0.95rem] font-normal" onClick={() => goTo(s)}
                aria-label={`Alterar ${k.toLowerCase()} (etapa ${STEPS[s].short})`}>
                Alterar
              </button>
            </dd>
          </div>
        ))}
      </dl>

      {!g.organizerEmail.trim() && (
        <Notice tone="warn" title="Você não informou e-mail.">
          Tudo bem, mas guarde o link do painel logo depois de criar: copie e mande para você mesmo no WhatsApp, ou salve nos favoritos.
          Sem e-mail não dá para recuperar o painel em “Perdi meu link”; ele fica salvo só neste aparelho.{" "}
          <button type="button" className="link" onClick={() => goTo(0)}>Adicionar e-mail</button>
        </Notice>
      )}

      {reachable > 0 && channels && (
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-pine)]" checked={draft.sendInvites} onChange={(e) => setSend(e.target.checked)} />
          <span>
            Mandar agora o link pessoal de cada participante por {channels} ({reachable} {reachable === 1 ? "pessoa tem" : "pessoas têm"} contato).
            <span className="block text-[0.95rem] text-muted">Quem não tiver contato recebe o link pelo painel, depois.</span>
          </span>
        </label>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper p-4">
        <input id="consent" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-pine)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Li <Link href="/duvidas#privacidade" target="_blank" className="link">como os dados são usados<span className="sr-only"> (abre em nova aba)</span></Link>. Os nomes e contatos servem só para
          esta brincadeira e são apagados 30 dias depois da festa, ou antes, se eu encerrar o grupo.
        </span>
      </label>
    </div>
  );
}
