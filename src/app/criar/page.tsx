import type { Metadata } from "next";
import { emailEnabled, whatsappServerEnabled } from "@/lib/notify";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Criar amigo secreto" };

export default function CreatePage() {
  // Os textos do formulário só prometem avisos pelos canais que estão ligados de verdade.
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Wizard whatsapp={whatsappServerEnabled()} email={emailEnabled()} />
    </div>
  );
}
