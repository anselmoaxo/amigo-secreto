// Aplica os arquivos de db/migrations em ordem. Uso: npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // No build da Vercel (--se-configurado), sem banco só avisamos e seguimos.
  const optional = process.argv.includes("--se-configurado");
  console[optional ? "warn" : "error"]("DATABASE_URL não definida (veja .env.example). Migrações não aplicadas.");
  process.exit(optional ? 0 : 1);
}
// Na Vercel, só o deploy de produção aplica migrações. O Preview pode apontar para o mesmo banco
// da produção, e um branch em revisão não pode mudar o esquema do banco real antes do merge.
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.warn(`Ambiente ${process.env.VERCEL_ENV ?? "desconhecido"} da Vercel: migrações não aplicadas (só a produção aplica).`);
  process.exit(0);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), "db", "migrations");

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`aplicada: ${file}`);
  }
  console.log("banco atualizado");
} finally {
  await sql.end();
}
