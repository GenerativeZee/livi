import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { liveStreams, products, productVariants, streamPins, streamProducts, type Db } from "@stealth/db";
import type { Product } from "@stealth/shared";

/** The stream the spike pages show: the most recently scheduled one that hasn't ended. */
export async function getFeaturedStream(db: Db) {
  const [stream] = await db
    .select()
    .from(liveStreams)
    .where(ne(liveStreams.status, "ended"))
    .orderBy(desc(liveStreams.scheduledAt))
    .limit(1);
  return stream ?? null;
}

/** Active products lined up for a stream, in the creator's order, with their sizes. */
export async function getStreamLineup(db: Db, streamId: string): Promise<Product[]> {
  const rows = await db
    .select({ product: products })
    .from(streamProducts)
    .innerJoin(products, eq(products.id, streamProducts.productId))
    .where(and(eq(streamProducts.streamId, streamId), eq(products.isActive, true)))
    .orderBy(asc(streamProducts.sortOrder));
  if (rows.length === 0) return [];

  const variants = await db
    .select()
    .from(productVariants)
    .where(
      inArray(
        productVariants.productId,
        rows.map((r) => r.product.id),
      ),
    )
    .orderBy(asc(productVariants.sortOrder));

  return rows.map(({ product: p }) => ({
    id: p.id,
    sellerId: p.sellerId,
    title: p.title,
    description: p.description,
    imageUrls: p.imageUrls,
    price: p.pricePaise,
    mrp: p.mrpPaise ?? undefined,
    gstBps: p.gstBps,
    variants: variants.filter((v) => v.productId === p.id).map((v) => ({ id: v.id, label: v.label, stock: v.stock })),
  }));
}

export async function isInLineup(db: Db, streamId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ productId: streamProducts.productId })
    .from(streamProducts)
    .where(and(eq(streamProducts.streamId, streamId), eq(streamProducts.productId, productId)));
  return Boolean(row);
}

/** The product pinned right now, so viewers who join mid-pin see the card immediately. */
export async function getCurrentPin(db: Db, streamId: string): Promise<string | null> {
  const [pin] = await db
    .select({ productId: streamPins.productId })
    .from(streamPins)
    .where(and(eq(streamPins.streamId, streamId), isNull(streamPins.unpinnedAt)))
    .orderBy(desc(streamPins.pinnedAt))
    .limit(1);
  return pin?.productId ?? null;
}
