import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { setPin } from "@/server/pins";
import { getProviders } from "@/server/providers";
import { isCreator, unauthorized } from "@/server/spike-auth";

const Body = z.object({ streamId: z.uuid(), productId: z.uuid().nullable() });

/** Pins a product to the live stream, or unpins with `{ productId: null }`. */
export async function POST(request: Request) {
  if (!isCreator(request)) return unauthorized();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { streamId, productId: string | null }" }, { status: 400 });

  try {
    const sentAt = await setPin(await getDb(), getProviders().video, body.data.streamId, body.data.productId);
    return Response.json({ ok: true, sentAt });
  } catch (error) {
    return errorResponse(error);
  }
}
