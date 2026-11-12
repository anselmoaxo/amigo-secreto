import { redirect } from "next/navigation";

// Endereços antigos (antes dos links individuais) levam para a recuperação de links.
export default function OldGroupPage() {
  redirect("/recuperar?antigo=1");
}
