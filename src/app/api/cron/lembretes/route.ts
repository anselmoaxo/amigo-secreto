import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deleteExpiredGroups, participantToken, participantsWithEventOn } from "@/lib/queries";
import { sendReminder } from "@/lib/notify";
import { purgeRateLimits } from "@/lib/ratelimit";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Compara o segredo em tempo constante. */
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Roda uma vez por dia (vercel.json): lembra quem tem amigo secreto amanhã,
// apaga grupos cuja festa foi há mais de 30 dias e limpa contadores de limite vencidos.
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const people = await participantsWithEventOn(tomorrow);
  for (const p of people) {
    try {
      await sendReminder(p, await participantToken(p.id));
    } catch (e) {
      logError("lembrete", e);
    }
  }
  const deleted = await deleteExpiredGroups();
  await purgeRateLimits();
  return NextResponse.json({ date: tomorrow, sent: people.length, deleted }, { headers: { "Cache-Control": "no-store" } });
}
