import { NextResponse, type NextRequest } from "next/server";
import { participantsWithEventOn } from "@/lib/queries";
import { reminderEmail, sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/format";

// Roda uma vez por dia (vercel.json) e lembra quem tem amigo secreto amanhã.
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const people = await participantsWithEventOn(tomorrow);
  for (const p of people) {
    await sendEmail(p.email, `⏰ Amanhã tem amigo secreto: ${p.group_name}`, reminderEmail(p.display_name, p.group_name, p.group_id));
    await sendWhatsApp(
      p.phone,
      `⏰ Oi, ${p.display_name}! Amanhã é o amigo secreto "${p.group_name}". Já comprou o presente? Veja quem você tirou e a lista de desejos: ${siteUrl()}/grupos/${p.group_id}`,
    );
  }
  return NextResponse.json({ date: tomorrow, sent: people.length });
}
