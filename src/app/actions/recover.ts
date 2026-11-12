"use server";

import { after } from "next/server";
import * as q from "@/lib/queries";
import { sendRecoveredLinks } from "@/lib/notify";
import { isEmail } from "@/lib/validation";
import { limitIp } from "@/lib/access";
import { logError } from "@/lib/log";
import { hit, LIMITS } from "@/lib/ratelimit";
import { done, failed, guard, text, type ActionState } from "./state";

/**
 * Manda por e-mail todos os links ligados ao endereço.
 * A resposta é a mesma, no mesmo tempo, exista o endereço ou não: a busca e o envio
 * acontecem depois da resposta (after), então nem o texto nem a demora revelam quem usa o site.
 * Cada endereço recebe no máximo alguns e-mails por hora (o resto é ignorado em silêncio),
 * para que a recuperação não sirva para encher a caixa de alguém.
 */
export async function recoverAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = text(form, "email", 250).toLowerCase();
  if (!isEmail(email)) return failed("Confira o e-mail.", { email: "Confira o e-mail. Ex.: ana@gmail.com" });
  return guard(async () => {
    await limitIp("recoverPerIp");
    after(() => sendRecovery(email));
    return done(`Se houver grupos ligados a ${email}, os links chegam em alguns minutos. Confira também a caixa de spam.`);
  });
}

async function sendRecovery(email: string) {
  try {
    const links = await q.linksForEmail(email);
    if (!links.admin.length && !links.participant.length) return;
    const [max, win] = LIMITS.recoverPerEmail;
    if (!(await hit(["recover-email", email], max, win))) return;
    await sendRecoveredLinks(email, links);
  } catch (e) {
    logError("recuperar", e);
  }
}
