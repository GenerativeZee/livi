import { DEMO_CREATOR, DEMO_PRODUCTS, DEMO_SELLERS, DEMO_SHOPPER, DEMO_STREAM } from "@stealth/shared";
import type { Db } from "./client";
import {
  addresses,
  creators,
  liveStreams,
  productVariants,
  products,
  sellers,
  streamProducts,
  users,
} from "./schema";

export interface SeedOptions {
  /** Razorpay Route linked accounts to attach to the demo seller/creator, for testing real split payments. */
  sellerPaymentAccountId?: string;
  creatorPaymentAccountId?: string;
}

/** Inserts the demo catalog. Safe to run on an empty database only. */
export async function seed(db: Db, options: SeedOptions = {}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(users).values([
      { id: DEMO_SHOPPER.id, phone: DEMO_SHOPPER.phone, name: DEMO_SHOPPER.name },
      { id: DEMO_CREATOR.userId, phone: DEMO_CREATOR.phone, name: DEMO_CREATOR.displayName },
      ...DEMO_SELLERS.map((s) => ({ id: s.userId, phone: s.phone, name: s.businessName })),
    ]);
    await tx.insert(addresses).values({ userId: DEMO_SHOPPER.id, ...DEMO_SHOPPER.address });

    await tx.insert(sellers).values(
      DEMO_SELLERS.map((s) => ({
        id: s.id,
        ownerUserId: s.userId,
        businessName: s.businessName,
        status: "approved" as const,
        razorpayAccountId: options.sellerPaymentAccountId,
      })),
    );
    await tx.insert(creators).values({
      id: DEMO_CREATOR.id,
      userId: DEMO_CREATOR.userId,
      handle: DEMO_CREATOR.handle,
      displayName: DEMO_CREATOR.displayName,
      commissionBps: DEMO_CREATOR.commissionBps,
      razorpayAccountId: options.creatorPaymentAccountId,
    });

    await tx.insert(products).values(
      DEMO_PRODUCTS.map((p) => ({
        id: p.id,
        sellerId: p.sellerId,
        title: p.title,
        description: p.description,
        imageUrls: p.imageUrls,
        pricePaise: p.price,
        mrpPaise: p.mrp,
        gstBps: p.gstBps,
      })),
    );
    await tx.insert(productVariants).values(
      DEMO_PRODUCTS.flatMap((p) =>
        p.variants.map((v, sortOrder) => ({ id: v.id, productId: p.id, label: v.label, stock: v.stock, sortOrder })),
      ),
    );

    await tx.insert(liveStreams).values({
      id: DEMO_STREAM.id,
      creatorId: DEMO_STREAM.creatorId,
      title: DEMO_STREAM.title,
      scheduledAt: new Date(),
    });
    await tx
      .insert(streamProducts)
      .values(DEMO_STREAM.productIds.map((productId, sortOrder) => ({ streamId: DEMO_STREAM.id, productId, sortOrder })));
  });
}
