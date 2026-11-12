import { devLog, logError } from "./log";

/**
 * Envio de WhatsApp pela Evolution API (v2).
 * Sem EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE, só registra no log.
 */

/** Deixa só dígitos e põe o 55 do Brasil quando faltar. Retorna null se não parecer telefone. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

export async function sendWhatsApp(phone: string | null, text: string) {
  const number = normalizePhone(phone);
  if (!number) return;
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!base || !key || !instance) {
    // Em produção o texto vai para o log sem o token do link (devLog tira).
    devLog(`[whatsapp desativado] para ${number}: ${text}`);
    return;
  }
  try {
    const res = await fetch(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) console.error("Falha no WhatsApp", res.status);
  } catch (e) {
    logError("whatsapp", e);
  }
}
