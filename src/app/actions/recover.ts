"use server";

import * as q from "@/lib/queries";
import { sendRecoveredLinks } from "@/lib/notify";
import { isEmail } from "@/lib/validation";
import { done, failed, guard, text, type ActionState } from "./state";

/** Manda por e-mail todos os links ligados ao endereço. A resposta é a mesma exista ou não, para não revelar quem usa o site. */
export async function recoverAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = text(form, "email", 250).toLowerCase();
  if (!isEmail(email)) return failed("Confira o e-mail.", { email: "Confira o e-mail. Ex.: ana@gmail.com" });
  return guard(async () => {
    const links = await q.linksForEmail(email);
    if (links.admin.length || links.participant.length) await sendRecoveredLinks(email, links);
    return done(`Se houver grupos ligados a ${email}, os links chegam em alguns minutos. Confira também a caixa de spam.`);
  });
}
