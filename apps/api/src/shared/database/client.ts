import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export { schema };
/** O mesmo tipo serve para PGlite (desenvolvimento e testes) e Postgres (produção): a API do Drizzle é igual. */
export type Db = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

/**
 * DATABASE_URL:
 * - postgres://…  → Postgres real (produção)
 * - memory://     → PGlite em memória (testes)
 * - vazio ou pasta → PGlite em ficheiro (desenvolvimento, sem instalar nada)
 */
export async function createDb(url: string | undefined): Promise<{ db: Db; close: () => Promise<void> }> {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const pg = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new pg.default.Pool({ connectionString: url, max: 10 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = !url || url === "memory://" ? undefined : url.replace(/^file:\/\//, "");
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
