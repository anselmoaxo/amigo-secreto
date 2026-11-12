import type { Metadata } from "next";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Criar amigo secreto" };

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Wizard />
    </div>
  );
}
