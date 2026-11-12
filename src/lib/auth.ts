import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { sendEmail, loginEmail } from "./email";
import { siteUrl } from "./format";

const COOKIE = "sessao";
const SESSION_DAYS = 30;
const LOGIN_MINUTES = 30;

export type User = { id: string; email: string };

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

/** Cria um link mágico e manda por e-mail (em dev, sem Resend, aparece no terminal). */
export async function requestLogin(email: string, next: string) {
  const token = newToken();
  await sql`
    insert into login_tokens (token_hash, email, expires_at)
    values (${hash(token)}, ${email}, now() + ${`${LOGIN_MINUTES} minutes`}::interval)`;
  const url = `${siteUrl()}/auth/verificar?token=${token}&next=${encodeURIComponent(next)}`;
  await sendEmail(email, "Seu link de acesso ao Amigo Secreto", loginEmail(url), url);
}

/** Troca o token do link por uma sessão. Cada link vale uma vez. */
export async function consumeLoginToken(token: string): Promise<boolean> {
  const [row] = await sql<{ email: string }[]>`
    update login_tokens set used_at = now()
    where token_hash = ${hash(token)} and used_at is null and expires_at > now()
    returning email`;
  if (!row) return false;

  const [user] = await sql<{ id: string }[]>`
    insert into users (email) values (${row.email})
    on conflict (email) do update set email = excluded.email
    returning id`;
  const session = newToken();
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hash(session)}, ${user.id}, now() + ${`${SESSION_DAYS} days`}::interval)`;

  const store = await cookies();
  store.set(COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return true;
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [user] = await sql<User[]>`
    select u.id, u.email from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash(token)} and s.expires_at > now()`;
  return user ?? null;
}

export async function requireUser(next: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hash(token)}`;
  store.delete(COOKIE);
}
