export function formatDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function formatMoney(v: number | string | null) {
  if (v === null || v === "") return null;
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function priceRange(min: number | string | null, max: number | string | null) {
  const a = formatMoney(min);
  const b = formatMoney(max);
  if (a && b) return `${a} a ${b}`;
  if (b) return `até ${b}`;
  if (a) return `a partir de ${a}`;
  return null;
}

/** Só aceita caminhos internos, para não virar redirecionamento aberto. */
export function safeNext(next: string | null | undefined, fallback = "/grupos") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** 5511987654321 -> (11) 98765-4321 */
export function formatPhone(p: string) {
  const d = p.startsWith("55") ? p.slice(2) : p;
  const m = d.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
