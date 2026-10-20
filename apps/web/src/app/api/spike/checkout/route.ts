import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { createBuyNowOrder } from "@/server/orders";
import { getProviders } from "@/server/providers";
import { requireUser } from "@/server/session";

const Body = z.object({ streamId: z.uuid(), productId: z.uuid(), variantId: z.uuid() });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { streamId, productId, variantId }" }, { status: 400 });

  try {
    const buyer = await requireUser();
    const order = await createBuyNowOrder(await getDb(), getProviders().payments, { buyerUserId: buyer.id, ...body.data });
    return Response.json(order);
  } catch (error) {
    return errorResponse(error);
  }
}
