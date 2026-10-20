import { z } from "zod";
import { DEMO_SHOPPER } from "@stealth/shared";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { createBuyNowOrder } from "@/server/orders";
import { getProviders } from "@/server/providers";

const Body = z.object({ streamId: z.uuid(), productId: z.uuid(), variantId: z.uuid() });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { streamId, productId, variantId }" }, { status: 400 });

  try {
    // Every order belongs to the demo shopper until phone login exists.
    const order = await createBuyNowOrder(await getDb(), getProviders().payments, { buyerUserId: DEMO_SHOPPER.id, ...body.data });
    return Response.json(order);
  } catch (error) {
    return errorResponse(error);
  }
}
