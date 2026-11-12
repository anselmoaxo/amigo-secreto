import type { ReactNode } from "react";

/**
 * Os três tipos de link, sempre com a mesma cor e o mesmo texto:
 * - convite do grupo (verde): pode mandar para todo mundo;
 * - link pessoal (dourado): só da pessoa, mostra o resultado dela;
 * - painel do organizador (vermelho): administra o grupo.
 */
const KINDS = {
  invite: {
    label: "Convite do grupo",
    rule: "Pode mandar para todo mundo",
    cls: "border-pine/30 bg-pine-soft text-pine-dark",
    icon: "M4 8h16v12H4zM2 4h20v4H2zM12 4v16", // presente
  },
  participant: {
    label: "Link pessoal",
    rule: "Só seu: não repasse",
    cls: "border-gold/60 bg-gold-soft text-gold-ink",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", // pessoa
  },
  admin: {
    label: "Painel do organizador",
    rule: "Não compartilhe",
    cls: "border-cherry/30 bg-cherry-soft text-cherry-dark",
    icon: "M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z", // cadeado
  },
} as const;

export type Kind = keyof typeof KINDS;

export function LinkBadge({ kind, className = "" }: { kind: Kind; className?: string }) {
  const k = KINDS[kind];
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 rounded-full border px-3 py-1 text-[0.9rem] font-bold ${k.cls} ${className}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={k.icon} />
      </svg>
      {k.label}
      <span className="font-semibold">· {k.rule}</span>
    </span>
  );
}

/** Aviso padrão para links que dão acesso: quem tiver o link entra naquela área. */
export function LinkWarning({ kind, children }: { kind: "participant" | "admin"; children?: ReactNode }) {
  return (
    <p className="text-[0.95rem]">
      {kind === "admin"
        ? "Quem tiver este link consegue mudar o grupo, convidar e remover pessoas e fazer o sorteio. Guarde só para você."
        : "Quem tiver este link vê o seu resultado e a sua lista de desejos. Não repasse, nem no grupo da família."}
      {children}
    </p>
  );
}
