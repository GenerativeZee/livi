import { z } from "zod";
import { computeSplit, DEFAULT_TERMS, findDemoProduct } from "@stealth/shared";
import { createSplitOrder, razorpayKeyId } from "@/lib/razorpay";

const Body = z.object({ productId: z.string(), variantId: z.string() });

/** Prices the item on the server (never trust a client amount), splits it and opens a Razorpay order. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { productId, variantId }" }, { status: 400 });

  const product = findDemoProduct(body.data.productId);
  const variant = product?.variants.find((v) => v.id === body.data.variantId);
  if (!product || !variant) return Response.json({ error: "unknown product or size" }, { status: 404 });
  if (variant.stock < 1) return Response.json({ error: "out of stock" }, { status: 409 });

  const split = computeSplit(product.price, { ...DEFAULT_TERMS, gstBps: product.gstBps });
  const order = await createSplitOrder(split, `spike_${product.id}_${Date.now()}`);
  return Response.json({ orderId: order.id, amount: order.amount, keyId: razorpayKeyId(), split, title: product.title });
}
