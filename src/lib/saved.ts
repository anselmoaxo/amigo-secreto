"use client";

/**
 * Links guardados neste aparelho (localStorage), para a pessoa achar os grupos de novo
 * sem precisar de conta. Nada disso vai para o servidor.
 */
export type SavedLink = { kind: "admin" | "participant"; token: string; group: string; person?: string; savedAt: number };

const KEY = "amigo-secreto:links";

export function readLinks(): SavedLink[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveLink(link: Omit<SavedLink, "savedAt">) {
  try {
    const rest = readLinks().filter((l) => !(l.kind === link.kind && l.token === link.token));
    localStorage.setItem(KEY, JSON.stringify([{ ...link, savedAt: Date.now() }, ...rest].slice(0, 50)));
  } catch {
    // Modo privado ou armazenamento bloqueado: segue sem guardar.
  }
}

export function forgetLink(kind: SavedLink["kind"], token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readLinks().filter((l) => !(l.kind === kind && l.token === token))));
  } catch {}
}
