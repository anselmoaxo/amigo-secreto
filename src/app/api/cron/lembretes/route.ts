import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { reminderEmail, sendEmail } from "@/lib/email";

// Roda uma vez por dia (vercel.json) e lembra quem tem amigo secreto amanhã.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const admin = createAdminClient();
  const { data: groups } = await admin
    .from("groups").select("id, name, participants(display_name, email)")
    .eq("status", "drawn").eq("event_date", tomorrow);

  let sent = 0;
  for (const g of groups ?? []) {
    for (const p of g.participants ?? []) {
      if (!p.email) continue;
      await sendEmail(p.email, `⏰ Amanhã tem amigo secreto: ${g.name}`, reminderEmail(p.display_name, g.name, g.id));
      sent++;
    }
  }
  return NextResponse.json({ groups: groups?.length ?? 0, sent });
}
