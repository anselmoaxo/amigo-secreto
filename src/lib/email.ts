import { siteUrl } from "./format";

/** Envia e-mail pelo Resend. Sem RESEND_API_KEY, só registra no log. */
export async function sendEmail(to: string, subject: string, html: string, devLink?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[e-mail desativado] para ${to}: ${subject}${devLink ? `\n  link: ${devLink}` : ""}`);
    return;
  }
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
  if (!res.ok) console.error("Falha ao enviar e-mail", res.status, await res.text());
}

export function loginEmail(url: string) {
  return `<p>Clique no link abaixo para entrar no Amigo Secreto. Ele vale por 30 minutos.</p>
<p><a href="${url}">Entrar no Amigo Secreto</a></p>
<p>Se não foi você que pediu, ignore este e-mail.</p>`;
}

export function drawEmail(name: string, groupName: string, groupId: string) {
  const url = `${siteUrl()}/grupos/${groupId}`;
  return `<p>Oi, ${escapeHtml(name)}!</p>
<p>O sorteio do grupo <strong>${escapeHtml(groupName)}</strong> foi feito.</p>
<p><a href="${url}">Clique aqui para ver quem você tirou</a>. É segredo, só você vê.</p>`;
}

export function reminderEmail(name: string, groupName: string, groupId: string) {
  const url = `${siteUrl()}/grupos/${groupId}`;
  return `<p>Oi, ${escapeHtml(name)}!</p>
<p>Amanhã é o amigo secreto do grupo <strong>${escapeHtml(groupName)}</strong>. Já comprou o presente?</p>
<p><a href="${url}">Veja de novo quem você tirou e a lista de desejos</a>.</p>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
