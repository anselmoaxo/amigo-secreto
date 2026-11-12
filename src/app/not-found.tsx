import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-14">
      <p className="hand text-2xl font-bold text-gold-ink">Papelzinho perdido</p>
      <h1 className="text-3xl font-extrabold text-pine">Este link não funciona</h1>
      <p>
        Ele pode estar incompleto (confira se copiou até o fim), ter sido trocado por um novo pelo organizador,
        ou o grupo pode ter sido encerrado.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/recuperar" className="btn btn-pine">Receber meus links por e-mail</Link>
        <Link href="/meus-grupos" className="btn btn-ghost">Ver meus grupos</Link>
      </div>
    </div>
  );
}
