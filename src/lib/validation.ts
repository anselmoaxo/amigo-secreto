/**
 * Validação compartilhada entre o navegador (formulário em etapas) e o servidor.
 * Sem dependências de servidor: pode ser importada em componentes de cliente.
 */

export const OCCASIONS = [
  { value: "natal", label: "Natal" },
  { value: "fim-de-ano", label: "Fim de ano" },
  { value: "empresa", label: "Confraternização da empresa" },
  { value: "familia", label: "Encontro de família" },
  { value: "amigos", label: "Entre amigos" },
  { value: "aniversario", label: "Aniversário" },
  { value: "pascoa", label: "Páscoa (chocolate)" },
  { value: "outro", label: "Outra ocasião" },
] as const;
export type Occasion = (typeof OCCASIONS)[number]["value"];
export const occasionLabel = (v: string) => OCCASIONS.find((o) => o.value === v)?.label ?? "Amigo secreto";

export type PersonInput = { name: string; email: string; phone: string; team: string };

export type GroupInput = {
  name: string;
  occasion: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  organizerJoins: boolean;
  eventDate: string;
  eventTime: string;
  location: string;
  minValue: string;
  maxValue: string;
  description: string;
  rsvpDeadline: string;
  wishlistEnabled: boolean;
  wishlistUntil: string;
  allowChanges: boolean;
  organizerCanSeePairs: boolean;
};

export const emptyGroup: GroupInput = {
  name: "", occasion: "natal", organizerName: "", organizerEmail: "", organizerPhone: "", organizerJoins: true,
  eventDate: "", eventTime: "", location: "", minValue: "", maxValue: "", description: "",
  rsvpDeadline: "", wishlistEnabled: true, wishlistUntil: "", allowChanges: true, organizerCanSeePairs: false,
};

export type Errors = Partial<Record<string, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isEmail = (s: string) => s.length <= 200 && EMAIL.test(s);

/** Deixa só dígitos e põe o 55 do Brasil quando faltar. null se não parecer telefone. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

/** "50", "50,00", "1.234,50" -> número; "" -> null; inválido -> NaN */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

function validDate(s: string) {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Hoje no fuso de Brasília, como YYYY-MM-DD. */
export const todayBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Campos de cada etapa do formulário de criação (para validar por etapa). */
export const STEP_FIELDS = {
  basics: ["name", "occasion", "organizerName", "organizerEmail", "organizerPhone"],
  event: ["eventDate", "eventTime", "location", "minValue", "maxValue", "description"],
  rules: ["rsvpDeadline", "wishlistUntil"],
} as const;

export function validateGroup(v: GroupInput, opts: { isNew?: boolean } = {}): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  if (!name) e.name = "Dê um nome ao grupo.";
  else if (name.length > 80) e.name = "Use até 80 caracteres.";

  if (!OCCASIONS.some((o) => o.value === v.occasion)) e.occasion = "Escolha uma ocasião.";

  const org = v.organizerName.trim();
  if (!org) e.organizerName = "Diga seu nome.";
  else if (org.length > 60) e.organizerName = "Use até 60 caracteres.";

  if (v.organizerEmail.trim() && !isEmail(v.organizerEmail.trim())) e.organizerEmail = "Confira o e-mail. Ex.: ana@gmail.com";
  if (v.organizerPhone.trim() && !normalizePhone(v.organizerPhone)) e.organizerPhone = "Use DDD + número. Ex.: (11) 98765-4321";

  if (v.eventDate && !validDate(v.eventDate)) e.eventDate = "Data inválida.";
  else if (v.eventDate && opts.isNew && v.eventDate < todayBR()) e.eventDate = "Essa data já passou.";
  if (v.eventTime && !TIME.test(v.eventTime)) e.eventTime = "Horário inválido.";
  if (v.location.trim().length > 120) e.location = "Use até 120 caracteres.";

  const min = parseMoney(v.minValue);
  const max = parseMoney(v.maxValue);
  if (min !== null && (isNaN(min) || min < 0 || min > 100000)) e.minValue = "Valor inválido.";
  if (max !== null && (isNaN(max) || max < 0 || max > 100000)) e.maxValue = "Valor inválido.";
  if (!e.minValue && !e.maxValue && min !== null && max !== null && min > max) e.maxValue = "O máximo precisa ser maior que o mínimo.";

  if (v.description.trim().length > 500) e.description = "Use até 500 caracteres.";

  if (v.rsvpDeadline && !validDate(v.rsvpDeadline)) e.rsvpDeadline = "Data inválida.";
  else if (v.rsvpDeadline && v.eventDate && v.rsvpDeadline > v.eventDate) e.rsvpDeadline = "O prazo precisa ser antes da festa.";

  if (v.wishlistEnabled && v.wishlistUntil) {
    if (!validDate(v.wishlistUntil)) e.wishlistUntil = "Data inválida.";
    else if (v.eventDate && v.wishlistUntil > v.eventDate) e.wishlistUntil = "A lista precisa fechar até o dia da festa.";
  }
  return e;
}

export function validatePerson(p: PersonInput): Errors {
  const e: Errors = {};
  const name = p.name.trim();
  if (!name) e.name = "Escreva o nome.";
  else if (name.length > 60) e.name = "Use até 60 caracteres.";
  if (p.email.trim() && !isEmail(p.email.trim())) e.email = "Confira o e-mail.";
  if (p.phone.trim() && !normalizePhone(p.phone)) e.phone = "Use DDD + número.";
  if (p.team.trim().length > 40) e.team = "Use até 40 caracteres.";
  return e;
}

/** Valores limpos, prontos para o banco. */
export function cleanGroup(v: GroupInput) {
  const opt = (s: string) => s.trim() || null;
  return {
    name: v.name.trim(),
    occasion: v.occasion,
    organizerName: v.organizerName.trim(),
    organizerEmail: opt(v.organizerEmail)?.toLowerCase() ?? null,
    organizerPhone: normalizePhone(v.organizerPhone),
    organizerJoins: v.organizerJoins,
    eventDate: opt(v.eventDate),
    eventTime: opt(v.eventTime),
    location: opt(v.location),
    minValue: parseMoney(v.minValue),
    maxValue: parseMoney(v.maxValue),
    description: opt(v.description),
    rsvpDeadline: opt(v.rsvpDeadline),
    wishlistEnabled: v.wishlistEnabled,
    wishlistUntil: v.wishlistEnabled ? opt(v.wishlistUntil) : null,
    allowChanges: v.allowChanges,
    organizerCanSeePairs: v.organizerCanSeePairs,
  };
}
export type CleanGroup = ReturnType<typeof cleanGroup>;

export function cleanPerson(p: PersonInput) {
  return {
    name: p.name.trim(),
    email: p.email.trim().toLowerCase() || null,
    phone: normalizePhone(p.phone),
    team: p.team.trim() || null,
  };
}
export type CleanPerson = ReturnType<typeof cleanPerson>;
