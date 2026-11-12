import { sendMagicLink } from "../actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; enviado?: string; erro?: string }>;
}) {
  const { next, enviado, erro } = await searchParams;
  if (enviado) {
    return (
      <div className="card space-y-2 text-center">
        <h1 className="text-xl font-bold">Confira seu e-mail 📬</h1>
        <p>Mandamos um link de acesso para <strong>{enviado}</strong>. Abra no mesmo aparelho.</p>
      </div>
    );
  }
  return (
    <form action={sendMagicLink} className="card space-y-4">
      <h1 className="text-xl font-bold">Entrar</h1>
      <p className="text-sm text-stone-600">Sem senha: você recebe um link por e-mail.</p>
      {erro && <p className="error">{erro}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Seu e-mail</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <button className="btn w-full">Receber link de acesso</button>
    </form>
  );
}
