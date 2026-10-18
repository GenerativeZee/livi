import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/razorpay";

const Body = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "missing Razorpay payment fields" }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body.data;
  const verified = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  return Response.json({ verified, paymentId: razorpay_payment_id }, { status: verified ? 200 : 400 });
}
