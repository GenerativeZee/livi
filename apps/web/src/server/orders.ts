import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import {
  addresses,
  creators,
  liveStreams,
  orderItems,
  orders,
  products,
  productVariants,
  sellers,
  type Db,
} from "@stealth/db";
import {
  computeSplit,
  DEFAULT_TERMS,
  type CheckoutResponse,
  type PaidOrderResponse,
  type PaymentConfirmation,
  type Split,
} from "@stealth/shared";
import { isInLineup } from "./catalog";
import { AppError } from "./errors";
import type { PaymentProvider } from "./providers/payments/types";

export interface BuyNowInput {
  buyerUserId: string;
  streamId: string;
  productId: string;
  variantId: string;
}

/**
 * "Buy now" from a stream: prices the item on the server (never trust a client amount),
 * records the order with its split, and opens a payment with the provider.
 * Stock is only checked here; it's taken when payment is confirmed.
 */
export async function createBuyNowOrder(db: Db, payments: PaymentProvider, input: BuyNowInput): Promise<CheckoutResponse> {
  const [item] = await db
    .select({ product: products, variant: productVariants, seller: sellers })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(sellers, eq(sellers.id, products.sellerId))
    .where(and(eq(productVariants.id, input.variantId), eq(products.id, input.productId)));
  if (!item || !item.product.isActive) throw new AppError(404, "Unknown product or size");
  if (item.seller.status !== "approved") throw new AppError(409, "This seller isn't accepting orders right now");
  if (item.variant.stock < 1) throw new AppError(409, "Out of stock");

  const [stream] = await db
    .select({ stream: liveStreams, creator: creators })
    .from(liveStreams)
    .innerJoin(creators, eq(creators.id, liveStreams.creatorId))
    .where(eq(liveStreams.id, input.streamId));
  if (!stream) throw new AppError(404, "Unknown stream");
  if (!(await isInLineup(db, input.streamId, input.productId))) {
    throw new AppError(404, "That product isn't in this stream's lineup");
  }

  const [address] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, input.buyerUserId))
    .orderBy(asc(addresses.createdAt))
    .limit(1);
  if (!address) throw new AppError(400, "Add a delivery address first");

  const split = computeSplit(item.product.pricePaise, {
    ...DEFAULT_TERMS,
    gstBps: item.product.gstBps,
    creatorBps: stream.creator.commissionBps,
  });

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        buyerUserId: input.buyerUserId,
        sellerId: item.seller.id,
        creatorId: stream.creator.id,
        streamId: stream.stream.id,
        totalPaise: split.total,
        taxableValuePaise: split.taxableValue,
        platformCommissionPaise: split.platformCommission,
        creatorCommissionPaise: split.creatorCommission,
        tcsPaise: split.tcs,
        sellerPayoutPaise: split.seller,
        shippingAddress: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        },
      })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values({
      orderId: order.id,
      productId: item.product.id,
      variantId: item.variant.id,
      title: item.product.title,
      unitPricePaise: item.product.pricePaise,
      quantity: 1,
    });
    return order.id;
  });

  // Outside the transaction: a slow or failed provider call must not hold database locks.
  // If it fails, the order stays "created" with no payment and is simply abandoned.
  const session = await payments.createPayment({
    split,
    receipt: orderId,
    sellerAccountId: item.seller.razorpayAccountId,
    creatorAccountId: stream.creator.razorpayAccountId,
  });
  await db
    .update(orders)
    .set({ paymentProvider: payments.name, paymentOrderId: session.paymentOrderId })
    .where(eq(orders.id, orderId));

  return { orderId, title: item.product.title, split, session };
}

/**
 * Marks an order paid once the provider's confirmation verifies, and takes the stock.
 * Safe to call twice for the same payment (browser retry, or the future webhook arriving too).
 */
export async function confirmPayment(
  db: Db,
  payments: PaymentProvider,
  { paymentOrderId, paymentId, signature }: PaymentConfirmation,
): Promise<PaidOrderResponse> {
  if (!payments.verifyPayment(paymentOrderId, paymentId, signature)) {
    throw new AppError(400, "Payment could not be verified");
  }

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.paymentOrderId, paymentOrderId)).for("update");
    if (!order) throw new AppError(404, "Unknown order");

    if (order.status === "paid") {
      if (order.paymentId === paymentId) return paidResponse(order);
      throw new AppError(409, "Order was already paid by a different payment");
    }
    if (order.status !== "created") throw new AppError(409, `Order is ${order.status}`);

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      // Conditional decrement: never sells stock that another buyer took in the meantime.
      const taken = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
        .where(and(eq(productVariants.id, item.variantId), gte(productVariants.stock, item.quantity)))
        .returning({ id: productVariants.id });
      if (taken.length === 0) {
        // TODO(orders): reserve stock at checkout and refund automatically; until then this needs a manual refund.
        throw new AppError(409, `"${item.title}" sold out while you were paying. Your payment will be refunded.`);
      }
    }

    const [paid] = await tx
      .update(orders)
      .set({ status: "paid", paymentId, paidAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    return paidResponse(paid);
  });
}

function paidResponse(order: typeof orders.$inferSelect): PaidOrderResponse {
  const split: Split = {
    total: order.totalPaise,
    taxableValue: order.taxableValuePaise,
    platformCommission: order.platformCommissionPaise,
    creatorCommission: order.creatorCommissionPaise,
    tcs: order.tcsPaise,
    seller: order.sellerPayoutPaise,
  };
  return { orderId: order.id, paymentId: order.paymentId ?? "", split };
}
