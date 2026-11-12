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
  { key: "basics", title: "O grupo", intro: "Comece pelo básico. Dá para mudar tudo depois." },
  { key: "event", title: "O encontro", intro: "Tudo aqui é opcional. Preencha o que já souber." },
  { key: "people", title: "Participantes", intro: "Adicione quem vai participar ou convide depois pelo link do grupo." },
  { key: "rules", title: "Regras", intro: "Como o grupo funciona até o sorteio." },
  { key: "review", title: "Revisar e criar", intro: "Confira antes de criar." },
] as const;

const STORAGE = "amigo-secreto:rascunho";
const emptyPerson: PersonInput = { name: "", email: "", phone: "", team: "" };

type Draft = { step: number; group: GroupInput; people: PersonInput[]; sendInvites: boolean };

export function Wizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ step: 0, group: emptyGroup, people: [], sendInvites: true });
  const [errors, setErrors] = useState<Errors>({});
  const [personErrors, setPersonErrors] = useState<Record<number, Errors>>({});
  const [formError, setFormError] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, start] = useTransition();
  const [restored, setRestored] = useState(false);
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
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [draft.step]);

  const { step, group, people } = draft;
  const current = STEPS[step];
  const set = <K extends keyof GroupInput>(k: K, v: GroupInput[K]) => {
    setDraft((d) => ({ ...d, group: { ...d.group, [k]: v } }));
    setErrors((e) => ({ ...e, [k]: undefined }));
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
    setFormError("");
    setDraft((d) => ({ ...d, step: Math.max(d.step - 1, 0) }));
  }

  const total = people.length + (group.organizerJoins ? 1 : 0);
  const needPeopleNow = !group.allowChanges && total < 3;

  function submit() {
    setFormError("");
    if (!consent) return setFormError("Confirme que leu como os dados são usados.");
    if (needPeopleNow) return setFormError("Com a lista fechada, o grupo precisa de pelo menos 3 pessoas. Adicione participantes ou permita entrar depois.");
    start(async () => {
      try {
        const res = await createGroupAction({ group, people, sendInvites: draft.sendInvites });
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          setPersonErrors(res.personErrors ?? {});
          setFormError(res.error);
          return;
        }
        saveLink({ kind: "admin", token: res.adminToken, group: res.groupName });
        if (res.myToken) saveLink({ kind: "participant", token: res.myToken, group: res.groupName, person: group.organizerName });
        try { sessionStorage.removeItem(STORAGE); } catch {}
        router.push(`/o/${res.adminToken}?novo=1`);
      } catch {
        setFormError("Sem conexão com o servidor. Confira sua internet; seus dados continuam aqui.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-muted" aria-live="polite">Etapa {step + 1} de {STEPS.length}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.key} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-pine" : "bg-line"}`} />
          ))}
        </div>
      </div>

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
          {current.key === "basics" && <BasicsFields value={group} errors={errors} set={set} />}
          {current.key === "event" && <EventFields value={group} errors={errors} set={set} />}
          {current.key === "people" && (
            <PeopleStep
              people={people} errors={personErrors} organizer={group.organizerJoins ? group.organizerName : null}
              onChange={(p) => { setDraft((d) => ({ ...d, people: p })); setPersonErrors({}); }}
              allowChanges={group.allowChanges}
            />
          )}
          {current.key === "rules" && <RuleFields value={group} errors={errors} set={set} />}
          {current.key === "review" && (
            <Review draft={draft} goTo={(s) => setDraft((d) => ({ ...d, step: s }))}
              setSend={(v) => setDraft((d) => ({ ...d, sendInvites: v }))} consent={consent} setConsent={setConsent} />
          )}
        </div>

        {formError && <Notice tone="error">{formError}</Notice>}
        {current.key === "review" && needPeopleNow && !formError && (
          <Notice tone="warn">Com a lista fechada, o grupo precisa de pelo menos 3 pessoas. Volte em Participantes ou em Regras.</Notice>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-ghost">Voltar</button>
          ) : (
            <Link href="/" className="btn btn-ghost">Cancelar</Link>
          )}
          {current.key === "review" ? (
            <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending || undefined}>
              {pending ? <><Spinner />Criando grupo…</> : "Criar grupo"}
            </button>
          ) : (
            <button type="submit" className="btn btn-pine">Continuar</button>
          )}
        </div>
      </form>
    </div>
  );
}

function PeopleStep({
  people, errors, organizer, onChange, allowChanges,
}: { people: PersonInput[]; errors: Record<number, Errors>; organizer: string | null; onChange: (p: PersonInput[]) => void; allowChanges: boolean }) {
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

      <ol className="space-y-4">
        {people.map((p, i) => {
          const e = errors[i] ?? {};
          return (
            <li key={i} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="hand mt-2.5 w-6 shrink-0 text-lg font-bold text-gold-ink">{i + 1}</span>
                <div className="flex-1 space-y-3">
                  <Field id={`p-${i}-name`} label="Nome" error={e.name}>
                    <input {...fieldProps(`p-${i}-name`, e.name)} className="input" value={p.name} maxLength={60}
                      autoComplete="off" onChange={(x) => update(i, "name", x.target.value)} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={`p-${i}-email`} label="E-mail" optional error={e.email}>
                      <input {...fieldProps(`p-${i}-email`, e.email)} className="input" type="email" inputMode="email" autoComplete="off"
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
                <button type="button" onClick={() => remove(i)} className="btn btn-sm -mr-2 px-3 text-cherry hover:bg-cherry-soft" aria-label={`Remover ${p.name || `participante ${i + 1}`}`}>
                  Remover
                </button>
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
  draft, goTo, setSend, consent, setConsent,
}: { draft: Draft; goTo: (s: number) => void; setSend: (v: boolean) => void; consent: boolean; setConsent: (v: boolean) => void }) {
  const g = draft.group;
  const price = priceRange(parseMoney(g.minValue), parseMoney(g.maxValue));
  const when = [formatDate(g.eventDate || null), g.eventTime].filter(Boolean).join(" às ");
  const withContact = draft.people.filter((p) => p.email.trim()).length;

  const rows: [string, string, number][] = [
    ["Grupo", `${g.name} (${occasionLabel(g.occasion)})`, 0],
    ["Organizador", `${g.organizerName}${g.organizerJoins ? ", participa do sorteio" : ", só organiza"}`, 0],
    ["Contato", [g.organizerEmail, g.organizerPhone && formatPhone(normalizePhone(g.organizerPhone) ?? g.organizerPhone)].filter(Boolean).join(" e ") || "Não informado", 0],
    ["Quando", when || "Sem data", 1],
    ["Onde", g.location || "Sem local", 1],
    ["Valor", price || "Sem valor definido", 1],
    ["Participantes", `${draft.people.length + (g.organizerJoins ? 1 : 0)} ${draft.people.length + (g.organizerJoins ? 1 : 0) === 1 ? "pessoa" : "pessoas"} por enquanto`, 2],
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
            <dd className="col-start-1 row-start-2 font-semibold sm:col-start-2 sm:row-start-1">{v}</dd>
            <dd className="col-start-2 row-span-2 row-start-1 self-center sm:col-start-3">
              <button type="button" className="link py-2 text-[0.95rem] font-normal" onClick={() => goTo(s)} aria-label={`Alterar ${k.toLowerCase()}`}>
                Alterar
              </button>
            </dd>
          </div>
        ))}
      </dl>

      {withContact > 0 && (
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-pine)]" checked={draft.sendInvites} onChange={(e) => setSend(e.target.checked)} />
          <span>Enviar agora o link de cada pessoa por e-mail ({withContact} {withContact === 1 ? "pessoa" : "pessoas"} com e-mail)</span>
        </label>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper p-4">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-pine)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Li <Link href="/duvidas#privacidade" target="_blank" className="link">como os dados são usados</Link>. Os nomes e contatos servem só para
          esta brincadeira e são apagados 30 dias depois da festa, ou antes, se eu encerrar o grupo.
        </span>
      </label>
    </div>
  );
}
