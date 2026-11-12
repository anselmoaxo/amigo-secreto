import type { ReactNode } from "react";

/** Campo com rótulo, dica e erro ligados por aria. */
export function Field({
  id, label, hint, error, optional, children,
}: { id: string; label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-bold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(opcional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-[0.95rem] text-muted">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="text-[0.95rem] font-semibold text-cherry">{error}</p>}
    </div>
  );
}

/** Props de acessibilidade para um input dentro de <Field>. */
export const fieldProps = (id: string, error?: string, hint?: boolean) => ({
  id,
  "aria-invalid": error ? (true as const) : undefined,
  "aria-describedby": [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined,
});

type Tone = "success" | "error" | "info" | "warn";
const toneClass: Record<Tone, string> = {
  success: "bg-pine-soft text-pine-dark border-pine/25",
  error: "bg-cherry-soft text-cherry-dark border-cherry/25",
  info: "bg-sheet text-ink border-line",
  warn: "bg-gold-soft text-gold-ink border-gold/40",
};

export function Notice({ tone = "info", title, children, className = "" }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 ${toneClass[tone]} ${className}`}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
    </div>
  );
}

export function Section({ id, title, intro, children, aside }: { id?: string; title: ReactNode; intro?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className="scroll-mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={id ? `${id}-titulo` : undefined} className="text-xl font-bold text-pine">{title}</h2>
          {intro && <p className="mt-0.5 text-muted">{intro}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line px-5 py-7 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}

/** Interruptor acessível (checkbox nativo estilizado). */
export function Switch({
  id, name, label, hint, checked, defaultChecked, onChange, disabled,
}: {
  id: string; name?: string; label: ReactNode; hint?: ReactNode;
  checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-[0.95rem] text-muted">{hint}</span>}
      </label>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id} name={name} type="checkbox" role="switch" disabled={disabled}
          checked={checked} defaultChecked={defaultChecked}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          className="peer h-8 w-14 cursor-pointer appearance-none rounded-full bg-line transition-colors checked:bg-pine disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span aria-hidden className="pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-6" />
      </span>
    </div>
  );
}
