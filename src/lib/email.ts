import { siteUrl } from "./format";
import { devLog, logError } from "./log";

/** Envia e-mail pelo Resend. Sem RESEND_API_KEY, só registra no log. Retorna false se o envio falhar. */
export async function sendEmail(to: string, subject: string, html: string, devLink?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    devLog(`[e-mail desativado] para ${to}: ${subject}${devLink ? `\n  link: ${devLink}` : ""}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Amigo Secreto <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      // Só o status: o corpo da resposta pode repetir destinatário e conteúdo (com o link pessoal).
      console.error("Falha ao enviar e-mail", res.status);
      return false;
    }
    return true;
  } catch (e) {
    logError("e-mail", e);
    return false;
  }
}

const C = { bg: "#0b1033", card: "#ffffff", text: "#1f2340", muted: "#6b6f8a", gold: "#f5b82e", navy: "#141a4d" };

/** Botão dourado, no mesmo tom do banner. */
export function emailButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0"><tr><td style="border-radius:999px;background:${C.gold}">
<a href="${url}" style="display:inline-block;color:${C.navy};font-weight:700;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Moldura dos e-mails: banner da AnselmoTech no topo, cartão branco e rodapé. Tabelas e estilos inline para funcionar no Gmail e no Outlook. */
export function emailLayout(opts: { preheader: string; body: string; footer?: string }) {
  const site = siteUrl();
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Amigo Secreto</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.card};border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:0;line-height:0"><a href="${site}"><img src="${site}/email/banner.jpg" width="600" alt="Amigo Secreto AnselmoTech" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:28px 32px 12px;color:${C.text};font-size:16px;line-height:1.6">${opts.body}</td></tr>
${opts.footer ? `<tr><td style="padding:0 32px 24px;color:${C.muted};font-size:13px;line-height:1.5">${opts.footer}</td></tr>` : ""}
</table>
<p style="margin:16px 0 0;color:#9aa0c8;font-family:Arial,Helvetica,sans-serif;font-size:12px">Amigo Secreto · AnselmoTech</p>
</td></tr></table>
</body></html>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
