import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { confirmPayment } from "@/server/orders";
import { getProviders } from "@/server/providers";

const Body = z.object({ paymentOrderId: z.string(), paymentId: z.string(), signature: z.string() });

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { paymentOrderId, paymentId, signature }" }, { status: 400 });

  try {
    return Response.json(await confirmPayment(await getDb(), getProviders().payments, body.data));
  } catch (error) {
    return errorResponse(error);
  }
}
