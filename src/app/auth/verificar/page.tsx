import { verifyLogin } from "../../actions";

// O link do e-mail abre esta página e a pessoa confirma com um clique.
// Assim, leitores de e-mail que abrem links sozinhos não gastam o link.
export default async function Verify({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next } = await searchParams;
  if (!token) return <p className="card">Link incompleto. Peça um novo na tela de login.</p>;
  return (
    <form action={verifyLogin} className="card space-y-4 text-center">
      <h1 className="text-xl font-bold">Quase lá!</h1>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={next ?? ""} />
      <button className="btn w-full text-lg">Entrar no Amigo Secreto</button>
    </form>
  );
}
