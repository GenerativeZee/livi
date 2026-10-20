import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Works the same against a real Postgres server and the in-memory PGlite database. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Connects to a real Postgres server. Run migrations separately with `npm run db:migrate`. */
export function createDb(url: string): Db {
  return drizzlePostgres(postgres(url), { schema });
}

/**
 * Starts an empty in-memory Postgres (PGlite, Postgres compiled to WebAssembly) and applies the migrations.
 * Data lives only as long as the process, which suits local development and tests.
 */
export async function createMemoryDb(migrationsFolder: string): Promise<Db> {
  const db = drizzlePglite(new PGlite(), { schema });
  await migratePglite(db, { migrationsFolder });
  return db;
}
