import { NextResponse, type NextRequest } from "next/server";
import { deleteExpiredGroups, participantToken, participantsWithEventOn } from "@/lib/queries";
import { sendReminder } from "@/lib/notify";

// Roda uma vez por dia (vercel.json): lembra quem tem amigo secreto amanhã
// e apaga grupos cuja festa foi há mais de 30 dias.
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const people = await participantsWithEventOn(tomorrow);
  for (const p of people) {
    try {
      await sendReminder(p, await participantToken(p.id));
    } catch (e) {
      console.error("Falha no lembrete", e);
    }
  }
  const deleted = await deleteExpiredGroups();
  return NextResponse.json({ date: tomorrow, sent: people.length, deleted });
}
