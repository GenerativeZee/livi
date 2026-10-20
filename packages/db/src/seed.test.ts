import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS, DEMO_STREAM } from "@stealth/shared";
import { createMemoryDb } from "./client";
import { productVariants, streamProducts } from "./schema";
import { seed } from "./seed";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

describe("in-memory database", () => {
  it("applies migrations and seeds the demo catalog", async () => {
    const db = await createMemoryDb(migrationsFolder);
    await seed(db, { sellerPaymentAccountId: "acc_seller" });

    const products = await db.query.products.findMany();
    expect(products.map((p) => p.id).sort()).toEqual(DEMO_PRODUCTS.map((p) => p.id).sort());

    const lineup = await db.select().from(streamProducts).where(eq(streamProducts.streamId, DEMO_STREAM.id));
    expect(lineup).toHaveLength(DEMO_PRODUCTS.length);

    const sellers = await db.query.sellers.findMany();
    expect(sellers.every((s) => s.status === "approved" && s.razorpayAccountId === "acc_seller")).toBe(true);
  });

  it("enforces non-negative stock", async () => {
    const db = await createMemoryDb(migrationsFolder);
    await seed(db);
    const variantId = DEMO_PRODUCTS[0].variants[0].id;
    await expect(db.update(productVariants).set({ stock: -1 }).where(eq(productVariants.id, variantId))).rejects.toThrow();
  });
});
