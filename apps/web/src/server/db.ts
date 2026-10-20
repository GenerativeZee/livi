import "server-only";
import path from "node:path";
import { createDb, createMemoryDb, seed, type Db } from "@stealth/db";
import { seedEnv } from "./env";

// With DATABASE_URL set, the app uses that Postgres (migrate and seed it yourself).
// Without it, it starts an in-memory Postgres, migrated and seeded with demo data, that resets on every restart.
//
// The instance lives on globalThis so every route and page shares one database,
// even when Next.js loads modules more than once in development.
const globalForDb = globalThis as unknown as { db?: Promise<Db> };

/** Next.js runs with apps/web as the working directory. */
const MIGRATIONS_FOLDER = path.join(process.cwd(), "../../packages/db/migrations");

export function getDb(): Promise<Db> {
  globalForDb.db ??= open().catch((error) => {
    globalForDb.db = undefined; // let the next request retry
    throw error;
  });
  return globalForDb.db;
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return createDb(url);

  const db = await createMemoryDb(MIGRATIONS_FOLDER);
  const env = seedEnv();
  await seed(db, {
    sellerPaymentAccountId: env.RAZORPAY_SELLER_ACCOUNT_ID,
    creatorPaymentAccountId: env.RAZORPAY_CREATOR_ACCOUNT_ID,
  });
  console.log("[db] in-memory Postgres ready with demo data (resets on restart)");
  return db;
}
