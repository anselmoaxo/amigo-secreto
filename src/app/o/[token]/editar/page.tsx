import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as q from "@/lib/queries";
import { formatPhone } from "@/lib/format";
import type { GroupInput } from "@/lib/validation";
import { EditForm } from "./EditForm";

export const metadata: Metadata = { title: "Editar grupo", robots: { index: false } };

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await q.getGroupByAdminToken(token);
  if (!g) notFound();
  const me = (await q.listParticipants(g.id)).find((p) => p.is_organizer);
  const initial: GroupInput = {
    name: g.name, occasion: g.occasion, organizerName: g.organizer_name ?? me?.display_name ?? "",
    organizerEmail: g.organizer_email ?? "", organizerPhone: me?.phone ? formatPhone(me.phone) : "", organizerJoins: Boolean(me),
    eventDate: g.event_date ?? "", eventTime: g.event_time ?? "", location: g.location ?? "",
    minValue: g.min_value ? String(Number(g.min_value)).replace(".", ",") : "", maxValue: g.max_value ? String(Number(g.max_value)).replace(".", ",") : "",
    description: g.description ?? "", rsvpDeadline: g.rsvp_deadline ?? "", wishlistEnabled: g.wishlist_enabled,
    wishlistUntil: g.wishlist_until ?? "", allowChanges: g.allow_changes, organizerCanSeePairs: g.organizer_can_see_pairs,
  };
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <EditForm token={token} initial={initial} drawn={g.status === "drawn"} />
    </div>
  );
}
