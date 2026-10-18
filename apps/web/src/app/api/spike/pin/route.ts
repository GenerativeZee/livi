import { z } from "zod";
import { findDemoProduct } from "@stealth/shared";
import { sendStreamCue } from "@/lib/ivs";
import { isCreator, unauthorized } from "@/lib/spike-auth";

const Body = z.object({ productId: z.string().nullable() });

/** Pins a product to the live stream, or unpins with `{ productId: null }`. */
export async function POST(request: Request) {
  if (!isCreator(request)) return unauthorized();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { productId: string | null }" }, { status: 400 });

  const { productId } = body.data;
  if (productId && !findDemoProduct(productId)) {
    return Response.json({ error: "unknown product" }, { status: 404 });
  }
  const sentAt = Date.now();
  await sendStreamCue(productId ? { t: "pin", productId, sentAt } : { t: "unpin", sentAt });
  return Response.json({ ok: true, sentAt });
}
