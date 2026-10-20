import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, orders, productVariants, seed, type Db } from "@stealth/db";
import {
  DEMO_CREATOR,
  DEMO_PRODUCTS,
  DEMO_SHOPPER,
  DEMO_STREAM,
  type PaymentConfirmation,
  type SessionUser,
  type StreamCue,
} from "@stealth/shared";
import { getCurrentPin } from "./catalog";
import { AppError } from "./errors";
import { confirmPayment, createBuyNowOrder } from "./orders";
import { setPin } from "./pins";
import { createFakePayments } from "./providers/payments/fake";
import { subscribeToCues } from "./providers/video/cue-bus";
import { createFakeVideo } from "./providers/video/fake";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url));
const payments = createFakePayments();

const [saree, kurta] = DEMO_PRODUCTS;
const sareeVariant = saree.variants[0];
const kurtaM = kurta.variants[1];
const kurtaL = kurta.variants[2]; // seeded with 0 stock

let db: Db;
beforeEach(async () => {
  db = await createMemoryDb(migrationsFolder);
  await seed(db);
});

const buy = (variantId = sareeVariant.id, productId = saree.id) =>
  createBuyNowOrder(db, payments, { buyerUserId: DEMO_SHOPPER.id, streamId: DEMO_STREAM.id, productId, variantId });

/** What the browser sends back after the fake payment sheet's "Pay". */
function confirmationFor(order: Awaited<ReturnType<typeof buy>>): PaymentConfirmation {
  if (order.session.provider !== "fake") throw new Error("expected the fake provider");
  return { paymentOrderId: order.session.paymentOrderId, paymentId: order.session.paymentId, signature: order.session.payToken };
}

const stockOf = async (variantId: string) =>
  (await db.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)))[0].stock;

const rejectsWith = (status: number) => expect.objectContaining({ constructor: AppError, status });

describe("buy now", () => {
  it("prices on the server, records the split and takes stock only once paid", async () => {
    const order = await buy();
    expect(order.split.total).toBe(saree.price);
    expect(await stockOf(sareeVariant.id)).toBe(12);

    const paid = await confirmPayment(db, payments, confirmationFor(order));
    expect(paid.split).toEqual(order.split);
    expect(await stockOf(sareeVariant.id)).toBe(11);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(row).toMatchObject({ status: "paid", paymentProvider: "fake", buyerUserId: DEMO_SHOPPER.id, streamId: DEMO_STREAM.id });
  });

  it("treats a repeated confirmation as the same payment", async () => {
    const order = await buy();
    const first = await confirmPayment(db, payments, confirmationFor(order));
    const second = await confirmPayment(db, payments, confirmationFor(order));
    expect(second).toEqual(first);
    expect(await stockOf(sareeVariant.id)).toBe(11);
  });

  it("rejects a forged confirmation", async () => {
    const order = await buy();
    const forged = { ...confirmationFor(order), signature: "0".repeat(64) };
    await expect(confirmPayment(db, payments, forged)).rejects.toEqual(rejectsWith(400));
  });

  it("refuses sold-out sizes at checkout", async () => {
    await expect(buy(kurtaL.id, kurta.id)).rejects.toEqual(rejectsWith(409));
  });

  it("never sells the last unit twice", async () => {
    await db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, kurtaM.id));
    const first = await buy(kurtaM.id, kurta.id);
    const second = await buy(kurtaM.id, kurta.id); // both buyers saw it in stock

    await confirmPayment(db, payments, confirmationFor(first));
    await expect(confirmPayment(db, payments, confirmationFor(second))).rejects.toEqual(rejectsWith(409));
    expect(await stockOf(kurtaM.id)).toBe(0);
  });

  it("refuses a size that belongs to another product", async () => {
    await expect(buy(kurtaM.id, saree.id)).rejects.toEqual(rejectsWith(404));
  });
});

const host: SessionUser = {
  id: DEMO_CREATOR.userId,
  phone: DEMO_CREATOR.phone,
  name: DEMO_CREATOR.displayName,
  isAdmin: false,
  creatorId: DEMO_CREATOR.id,
  sellerIds: [],
};
const shopper: SessionUser = { ...host, id: DEMO_SHOPPER.id, phone: DEMO_SHOPPER.phone, creatorId: null };

describe("pins", () => {
  it("records the pin for late joiners and sends it to live viewers", async () => {
    const video = createFakeVideo();
    const received: StreamCue[] = [];
    const unsubscribe = subscribeToCues(DEMO_STREAM.id, (cue) => received.push(cue));

    await setPin(db, video, host, DEMO_STREAM.id, saree.id);
    expect(await getCurrentPin(db, DEMO_STREAM.id)).toBe(saree.id);

    await setPin(db, video, host, DEMO_STREAM.id, kurta.id);
    await setPin(db, video, host, DEMO_STREAM.id, null);
    expect(await getCurrentPin(db, DEMO_STREAM.id)).toBeNull();

    unsubscribe();
    expect(received.map((c) => (c.t === "pin" ? c.productId : "unpin"))).toEqual([saree.id, kurta.id, "unpin"]);
  });

  it("refuses products outside the stream's lineup", async () => {
    await expect(setPin(db, createFakeVideo(), host, DEMO_STREAM.id, crypto.randomUUID())).rejects.toEqual(rejectsWith(404));
  });

  it("only lets the stream's creator or an admin pin", async () => {
    const pin = (actor: SessionUser) => setPin(db, createFakeVideo(), actor, DEMO_STREAM.id, saree.id);
    await expect(pin(shopper)).rejects.toEqual(rejectsWith(403));
    await expect(pin({ ...shopper, isAdmin: true })).resolves.toBeTypeOf("number");
  });
});
