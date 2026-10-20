// Seeds a real Postgres (e.g. the docker-compose one) with the demo catalog.
// The in-memory development database seeds itself on startup and doesn't need this.
import { createDb } from "./client";
import { seed } from "./seed";

const url = process.env.DATABASE_URL ?? "postgres://stealth:stealth@localhost:5432/stealth";
await seed(createDb(url));
console.log("Seeded demo data into", url.replace(/:[^:@/]+@/, ":***@"));
process.exit(0);
