"use client";

import { Field, fieldProps, Switch } from "./ui";
import { OCCASIONS, type Errors, type GroupInput } from "@/lib/validation";

type Props = { value: GroupInput; errors: Errors; set: <K extends keyof GroupInput>(k: K, v: GroupInput[K]) => void };

/** Campos do grupo, divididos nos mesmos blocos da criação e da edição. */
export function BasicsFields({ value: v, errors: e, set, editing, whatsapp = true }: Props & { editing?: boolean; whatsapp?: boolean }) {
  return (
    <div className="space-y-5">
      <Field id="name" label="Nome do grupo" error={e.name} hint="Como o grupo vai aparecer no convite.">
        <input {...fieldProps("name", e.name, true)} className="input" value={v.name} maxLength={80} autoComplete="off"
          placeholder="Ex.: Família Silva 2026" onChange={(x) => set("name", x.target.value)} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="font-bold">Ocasião</legend>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input type="radio" name="occasion" value={o.value} checked={v.occasion === o.value}
                onChange={() => set("occasion", o.value)} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line-strong bg-white px-4 font-semibold text-ink peer-checked:border-pine peer-checked:bg-pine peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="organizerName" label="Seu nome" error={e.organizerName}>
        <input {...fieldProps("organizerName", e.organizerName)} className="input" value={v.organizerName} maxLength={60}
          autoComplete="given-name" onChange={(x) => set("organizerName", x.target.value)} />
      </Field>

      <Switch id="organizerJoins" label="Eu também participo do sorteio" hint={editing ? "Só dá para mudar antes do sorteio." : "Desligue se você só vai organizar."}
        checked={v.organizerJoins} onChange={(c) => set("organizerJoins", c)} />

      <ContactFields value={v} errors={e} set={set} editing={editing} whatsapp={whatsapp} />
    </div>
  );
}

/**
 * Contatos do organizador, opcionais, numa área secundária.
 * O WhatsApp só aparece quando o envio pelo site está ligado e o organizador participa:
 * os avisos do sorteio e o lembrete vão para quem está no sorteio.
 */
function ContactFields({ value: v, errors: e, set, editing, whatsapp }: Props & { editing?: boolean; whatsapp: boolean }) {
  // O WhatsApp do organizador fica guardado no participante dele, então só vale para quem participa.
  const showPhone = v.organizerJoins;
  return (
    <div role="group" aria-labelledby="contatos-titulo" aria-describedby="contatos-regra" className="space-y-4 rounded-xl border border-line bg-paper/70 p-4 sm:p-5">
      <div>
        <p id="contatos-titulo" className="font-bold">Seu contato</p>
        <p id="contatos-regra" className="text-[0.95rem] text-muted">
          {showPhone
            ? "Informe pelo menos um: e-mail ou WhatsApp. Não precisa criar conta; usamos só para mandar os links deste grupo e os avisos."
            : "Como você só organiza, informe o e-mail: é por ele que o link do painel chega. Não precisa criar conta."}
        </p>
      </div>

      <Field id="organizerEmail" label="Seu e-mail" error={e.organizerEmail}
        hint={editing
          ? "Com ele, se você perder o link do painel, recebe de novo em “Perdi meu link”."
          : "Recomendado. Mandamos o link do seu painel para este e-mail e, se você perder, dá para pedir de novo em “Perdi meu link”."}>
        <input {...fieldProps("organizerEmail", e.organizerEmail, true)} className="input" type="email" inputMode="email"
          autoComplete="email" autoCapitalize="off" spellCheck={false} value={v.organizerEmail} onChange={(x) => set("organizerEmail", x.target.value)} />
      </Field>

      {showPhone && (
        <Field id="organizerPhone" label="Seu WhatsApp" error={e.organizerPhone}
          hint={whatsapp
            ? "Você recebe por WhatsApp o aviso quando o sorteio sair e um lembrete na véspera da festa, se ela tiver data."
            : "Para o grupo conseguir falar com você."}>
          <input {...fieldProps("organizerPhone", e.organizerPhone, true)} className="input" type="tel" inputMode="tel"
            autoComplete="tel" placeholder="(11) 98765-4321" value={v.organizerPhone} onChange={(x) => set("organizerPhone", x.target.value)} />
        </Field>
      )}
    </div>
  );
}

export function EventFields({ value: v, errors: e, set }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="eventDate" label="Data" optional error={e.eventDate}>
          <input {...fieldProps("eventDate", e.eventDate)} className="input" type="date" value={v.eventDate} onChange={(x) => set("eventDate", x.target.value)} />
        </Field>
        <Field id="eventTime" label="Horário" optional error={e.eventTime}>
          <input {...fieldProps("eventTime", e.eventTime)} className="input" type="time" value={v.eventTime} onChange={(x) => set("eventTime", x.target.value)} />
        </Field>
      </div>
      <Field id="location" label="Local" optional error={e.location}>
        <input {...fieldProps("location", e.location)} className="input" value={v.location} maxLength={120}
          placeholder="Ex.: Casa da vó" onChange={(x) => set("location", x.target.value)} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="font-bold">Valor do presente <span className="font-normal text-muted">(opcional)</span></legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="minValue" label={<span className="font-normal">Mínimo (R$)</span>} error={e.minValue}>
            <input {...fieldProps("minValue", e.minValue)} className="input" inputMode="decimal" placeholder="50" value={v.minValue} onChange={(x) => set("minValue", x.target.value)} />
          </Field>
          <Field id="maxValue" label={<span className="font-normal">Máximo (R$)</span>} error={e.maxValue}>
            <input {...fieldProps("maxValue", e.maxValue)} className="input" inputMode="decimal" placeholder="100" value={v.maxValue} onChange={(x) => set("maxValue", x.target.value)} />
          </Field>
        </div>
      </fieldset>
      <Field id="description" label="Recado para os participantes" optional error={e.description}
        hint={`${v.description.length}/500. Aparece no convite.`}>
        <textarea {...fieldProps("description", e.description, true)} className="input" maxLength={500} rows={3}
          placeholder="Ex.: Vamos fazer a troca depois da ceia. Tragam o presente embrulhado!" value={v.description} onChange={(x) => set("description", x.target.value)} />
      </Field>
    </div>
  );
}

export function RuleFields({ value: v, errors: e, set, canEnablePairs = true }: Props & { canEnablePairs?: boolean }) {
  return (
    <div className="space-y-5">
      <Field id="rsvpDeadline" label="Prazo para confirmar participação" optional error={e.rsvpDeadline}
        hint="Depois dessa data o convite geral para de aceitar gente nova.">
        <input {...fieldProps("rsvpDeadline", e.rsvpDeadline, true)} className="input sm:max-w-xs" type="date" value={v.rsvpDeadline} onChange={(x) => set("rsvpDeadline", x.target.value)} />
      </Field>

      <div className="space-y-3 rounded-xl border border-line bg-white/60 p-4">
        <Switch id="wishlistEnabled" label="Lista de desejos" hint="Cada pessoa escreve sugestões. Só quem tirar a pessoa vê a lista dela."
          checked={v.wishlistEnabled} onChange={(c) => set("wishlistEnabled", c)} />
        {v.wishlistEnabled && (
          <Field id="wishlistUntil" label="Dá para mudar a lista até" optional error={e.wishlistUntil} hint="Sem data, fica aberta até o dia da festa.">
            <input {...fieldProps("wishlistUntil", e.wishlistUntil, true)} className="input sm:max-w-xs" type="date" value={v.wishlistUntil} onChange={(x) => set("wishlistUntil", x.target.value)} />
          </Field>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/60 p-4">
        <Switch id="allowChanges" label="Permitir entrar e sair depois de criado"
          hint="Ligado: o convite geral aceita gente nova e você pode adicionar ou remover pessoas até o sorteio. Desligado: a lista fica fechada."
          checked={v.allowChanges} onChange={(c) => set("allowChanges", c)} />
      </div>

      <div className="rounded-xl border border-gold/50 bg-gold-soft/60 p-4">
        <Switch id="organizerCanSeePairs" label="Eu posso ver todos os pares"
          disabled={!canEnablePairs && !v.organizerCanSeePairs}
          hint={canEnablePairs
            ? "Só ligue se precisar, por exemplo para ajudar quem perder o resultado. Todos os participantes verão um aviso de que você tem esse acesso. Depois de criado, dá para desligar, mas não para ligar."
            : "Este grupo foi criado sem esse acesso. Por segurança, ele não pode ser ligado depois."}
          checked={v.organizerCanSeePairs} onChange={(c) => set("organizerCanSeePairs", c)} />
      </div>
    </div>
  );
}
