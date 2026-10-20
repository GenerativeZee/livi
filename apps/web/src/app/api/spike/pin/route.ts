import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { setPin } from "@/server/pins";
import { getProviders } from "@/server/providers";
import { requireUser } from "@/server/session";

const Body = z.object({ streamId: z.uuid(), productId: z.uuid().nullable() });

/** Pins a product to the live stream, or unpins with `{ productId: null }`. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "expected { streamId, productId: string | null }" }, { status: 400 });

  try {
    const user = await requireUser();
    const sentAt = await setPin(await getDb(), getProviders().video, user, body.data.streamId, body.data.productId);
    return Response.json({ ok: true, sentAt });
  } catch (error) {
    return errorResponse(error);
  }
}
