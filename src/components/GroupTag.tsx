import { formatDate, priceRange } from "@/lib/format";
import { occasionLabel } from "@/lib/validation";
import type { Group } from "@/lib/queries";

const weekday = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });

/** Cabeçalho do grupo em forma de etiqueta de presente. */
export function GroupTag({ group, children, showDescription = true }: { group: Group; children?: React.ReactNode; showDescription?: boolean }) {
  const price = priceRange(group.min_value, group.max_value);
  const facts = [
    group.event_date && `${weekday(group.event_date)}, ${formatDate(group.event_date)}${group.event_time ? ` às ${group.event_time}` : ""}`,
    group.location,
    price && `Presente: ${price}`,
  ].filter(Boolean) as string[];
  return (
    <div className="tag">
      <div aria-hidden className="tag-shape" />
      <p className="text-[0.95rem] font-semibold text-gold-ink">{occasionLabel(group.occasion)}</p>
      <h1 className="text-2xl font-extrabold leading-tight text-pine sm:text-3xl">{group.name}</h1>
      {facts.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-muted">
          {facts.map((f) => <li key={f} className="first-letter:uppercase">{f}</li>)}
        </ul>
      )}
      {showDescription && group.description && (
        <p className="hand mt-3 whitespace-pre-line border-t border-dashed border-line pt-3 text-lg text-ink">{group.description}</p>
      )}
      {children}
    </div>
  );
}
