/**
 * Entende o que a pessoa colou no campo "Tenho um convite": o link inteiro, a mensagem
 * inteira do WhatsApp ou só o código. Sem dependências de servidor (roda no navegador).
 *
 * Só devolve caminhos internos (/g, /p, /o): nunca leva para outro site, mesmo que
 * colem um link de fora com um caminho parecido.
 */

export type LinkKind = "invite" | "participant" | "admin";

export type ParsedLink =
  | { ok: true; kind: LinkKind; path: string }
  | { ok: false; error: string };

const PREFIX: Record<string, LinkKind> = { g: "invite", p: "participant", o: "admin" };
// Mesmos limites do servidor: convite 6 a 32, links pessoais 16 a 64 caracteres.
const CODE = /^[A-Za-z0-9_-]{6,32}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const URL_IN_TEXT = /(?:https?:\/\/)?[A-Za-z0-9.-]+(?::\d+)?\/[gpo]\/[A-Za-z0-9_-]+/i;

/** Endereços deste site: o domínio público e, em desenvolvimento, o endereço aberto agora. */
function ownHosts(currentHost?: string) {
  const hosts = new Set<string>(["amigo-secreto.anselmotech.com.br"]);
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  } catch {}
  if (currentHost) hosts.add(currentHost);
  return hosts;
}

export function parseInviteInput(raw: string, currentHost?: string): ParsedLink {
  const text = raw.normalize("NFKC").trim();
  if (!text) return { ok: false, error: "Cole o link ou o código que você recebeu." };

  // Procura um endereço dentro do texto (a mensagem do WhatsApp tem texto antes e depois).
  // Primeiro tenta o texto todo sem espaços (link colado com espaço ou quebra de linha no meio).
  const compact = text.replace(/\s+/g, "");
  const url = compact.match(new RegExp(`^${URL_IN_TEXT.source}$`, "i"))?.[0] ?? text.match(URL_IN_TEXT)?.[0];
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    } catch {
      return { ok: false, error: "Esse link parece incompleto. Copie de novo a mensagem inteira e cole aqui." };
    }
    if (!ownHosts(currentHost).has(parsed.host.toLowerCase())) {
      return { ok: false, error: "Esse link não é do Amigo Secreto. Confira com quem te convidou." };
    }
    return fromPath(parsed.pathname);
  }

  // Caminho sem domínio (ex.: /g/abc123).
  if (/^\/[gpo]\//i.test(compact)) return fromPath(compact);

  // Só o código do convite.
  if (CODE.test(compact)) return { ok: true, kind: "invite", path: `/g/${compact}` };

  return { ok: false, error: "Não reconhecemos esse link. Copie a mensagem inteira do convite e cole aqui." };
}

function fromPath(pathname: string): ParsedLink {
  const m = pathname.match(/^\/([gpo])\/([^/?#]+)\/?$/i);
  if (!m) return { ok: false, error: "Esse link parece incompleto. Copie de novo a mensagem inteira e cole aqui." };
  const letter = m[1].toLowerCase();
  const kind = PREFIX[letter];
  const id = m[2];
  const valid = kind === "invite" ? CODE.test(id) : TOKEN.test(id);
  if (!valid) return { ok: false, error: "Esse link parece incompleto. Copie de novo a mensagem inteira e cole aqui." };
  return { ok: true, kind, path: `/${letter}/${id}` };
}

/** Abre o WhatsApp com a mensagem pronta (com o número, vai direto para a conversa). */
export const whatsappUrl = (text: string, phone?: string | null) =>
  `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
