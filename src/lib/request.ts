import "server-only";
import { headers } from "next/headers";

/**
 * IP de quem fez a requisição, para os limites de uso.
 *
 * Só confiamos em cabeçalhos de proxy quando o app roda atrás de um proxy conhecido:
 * na Vercel, x-forwarded-for é reescrito pela própria Vercel (o valor mandado pelo cliente é descartado).
 * Fora dela, só com TRUST_PROXY=1. Sem isso, todos contam como "direto" (limite por recurso continua valendo).
 *
 * IPv6 é agrupado por /64, porque uma única casa costuma ter um bloco inteiro.
 */
export async function clientIp(): Promise<string> {
  const trusted = process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1";
  if (!trusted) return "direto";
  const h = await headers();
  const raw = (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim();
  return normalizeIp(raw) || "desconhecido";
}

export function normalizeIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  if (!ip) return "";
  if (ip.includes(":") && !ip.startsWith("::ffff:")) {
    // Expande o suficiente para pegar os 4 primeiros blocos (/64).
    const [head] = ip.split("::");
    const blocks = head.split(":").filter(Boolean);
    while (blocks.length < 4) blocks.push("0");
    return `${blocks.slice(0, 4).join(":")}::/64`;
  }
  return ip.replace(/^::ffff:/, "");
}
