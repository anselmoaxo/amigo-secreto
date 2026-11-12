import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

/** Conexão única com o Postgres (local ou Neon). */
export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/amigo-secreto", {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
