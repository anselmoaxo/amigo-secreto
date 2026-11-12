import "server-only";
import { escapeHtml, sendEmail } from "./email";
import { sendWhatsApp } from "./whatsapp";
import { formatDate, priceRange, siteUrl } from "./format";
import type { Group } from "./queries";

/** Endereços dos links. O token vai no caminho, nunca o resultado do sorteio. */
export const participantUrl = (token: string) => `${siteUrl()}/p/${token}`;
export const adminUrl = (token: string) => `${siteUrl()}/o/${token}`;
export const inviteUrl = (code: string) => `${siteUrl()}/g/${code}`;

export const whatsappServerEnabled = () =>
  Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

function details(g: Pick<Group, "event_date" | "event_time" | "location" | "min_value" | "max_value">) {
  const when = [formatDate(g.event_date), g.event_time].filter(Boolean).join(" às ");
  return [when && `📅 ${when}`, g.location && `📍 ${g.location}`, priceRange(g.min_value, g.max_value) && `🎁 ${priceRange(g.min_value, g.max_value)}`]
    .filter(Boolean)
    .join("\n");
}

/** Mensagem pronta do convite geral do grupo (quem abrir digita o próprio nome). */
export function groupInviteText(g: Group) {
  const info = details(g);
  return [`🎁 Amigo secreto "${g.name}"!`, info, "", `Entre no grupo pelo link e escreva seu nome: ${inviteUrl(g.invite_code)}`]
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Mensagem com o link individual de uma pessoa. */
export function personalInviteText(name: string, g: Group, token: string) {
  const info = details(g);
  return [
    `Oi, ${name}! 🎁 Você está no amigo secreto "${g.name}".`,
    info,
    "",
    `Este link é só seu (não repasse): ${participantUrl(token)}`,
    "Por ele você confirma presença, monta sua lista de desejos e, depois do sorteio, vê quem tirou.",
  ]
    .filter(Boolean)
    .join("\n");
}

const button = (url: string, label: string) =>
  `<p style="margin:24px 0"><a href="${url}" style="background:#0F4D3A;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${label}</a></p>`;

const wrap = (body: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1E2A24;max-width:520px">${body}
<p style="font-size:13px;color:#5B6B62">Este link é pessoal. Quem tiver o link consegue ver o que está nele, então não repasse.</p></div>`;

/** Envia o link individual por e-mail e, se configurado, pelo WhatsApp do servidor. */
export async function sendPersonalInvite(p: { display_name: string; email: string | null; phone: string | null }, g: Group, token: string) {
  const channels: ("email" | "whatsapp")[] = [];
  const url = participantUrl(token);
  if (p.email) {
    await sendEmail(
      p.email,
      `🎁 Seu convite para o amigo secreto "${g.name}"`,
      wrap(`<p>Oi, ${escapeHtml(p.display_name)}!</p>
<p>${escapeHtml(g.organizer_name ?? "O organizador")} incluiu você no amigo secreto <strong>${escapeHtml(g.name)}</strong>.</p>
<p>${escapeHtml(details(g)).replace(/\n/g, "<br>")}</p>
<p>Pelo seu link você confirma presença, monta sua lista de desejos e, depois do sorteio, vê quem tirou.</p>
${button(url, "Abrir meu link")}`),
      url,
    );
    channels.push("email");
  }
  if (p.phone && whatsappServerEnabled()) {
    await sendWhatsApp(p.phone, personalInviteText(p.display_name, g, token));
    channels.push("whatsapp");
  }
  return channels;
}

export async function sendDrawNotice(p: { display_name: string; email: string | null; phone: string | null }, g: Group, token: string, redraw: boolean) {
  const url = participantUrl(token);
  const intro = redraw ? "O sorteio foi refeito. Seu resultado mudou." : "O sorteio foi feito!";
  if (p.email) {
    await sendEmail(
      p.email,
      `🎁 ${redraw ? "Sorteio refeito" : "Sorteio feito"}: ${g.name}`,
      wrap(`<p>Oi, ${escapeHtml(p.display_name)}!</p>
<p>${intro} Abra seu link num lugar reservado para ver quem você tirou no amigo secreto <strong>${escapeHtml(g.name)}</strong>.</p>
${button(url, "Ver quem eu tirei")}`),
      url,
    );
  }
  await sendWhatsApp(p.phone, `🎁 Oi, ${p.display_name}! ${intro} Veja quem você tirou no amigo secreto "${g.name}" (é segredo!): ${url}`);
}

export async function sendReminder(p: { display_name: string; email: string | null; phone: string | null; group_name: string }, token: string) {
  const url = participantUrl(token);
  if (p.email) {
    await sendEmail(
      p.email,
      `⏰ Amanhã tem amigo secreto: ${p.group_name}`,
      wrap(`<p>Oi, ${escapeHtml(p.display_name)}!</p>
<p>Amanhã é o amigo secreto <strong>${escapeHtml(p.group_name)}</strong>. Já comprou o presente?</p>
${button(url, "Ver quem eu tirei e a lista de desejos")}`),
      url,
    );
  }
  await sendWhatsApp(p.phone, `⏰ Oi, ${p.display_name}! Amanhã é o amigo secreto "${p.group_name}". Veja quem você tirou e a lista de desejos: ${url}`);
}

export async function sendOrganizerLinks(email: string, g: { name: string }, adminToken: string, myToken: string | null) {
  await sendEmail(
    email,
    `🎁 Seus links do amigo secreto "${g.name}"`,
    wrap(`<p>Seu grupo <strong>${escapeHtml(g.name)}</strong> foi criado. Guarde este e-mail.</p>
<p><strong>Painel do organizador</strong>: convide pessoas, defina regras e faça o sorteio.</p>
${button(adminUrl(adminToken), "Abrir painel do organizador")}
${myToken ? `<p><strong>Seu link de participante</strong>: onde você vê quem tirou.</p>${button(participantUrl(myToken), "Abrir meu link de participante")}` : ""}`),
    adminUrl(adminToken),
  );
}

export async function sendRecoveredLinks(
  email: string,
  links: { admin: { name: string; token: string }[]; participant: { name: string; token: string }[] },
) {
  const items = [
    ...links.admin.map((l) => `<li>Painel do organizador de <strong>${escapeHtml(l.name)}</strong>: <a href="${adminUrl(l.token)}">abrir</a></li>`),
    ...links.participant.map((l) => `<li>Seu link em <strong>${escapeHtml(l.name)}</strong>: <a href="${participantUrl(l.token)}">abrir</a></li>`),
  ];
  await sendEmail(email, "🎁 Seus links do Amigo Secreto", wrap(`<p>Aqui estão os links ligados a este e-mail:</p><ul>${items.join("")}</ul>`));
}
