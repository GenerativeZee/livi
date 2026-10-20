import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { getProviders } from "@/server/providers";
import { requireUser } from "@/server/session";
import { assertCanHost } from "@/server/streams";

/** Tells the creator page how to go live. The IVS stream key is a secret, so only the stream's host gets it. */
export async function GET(request: Request) {
  // Read the request outside the try: during build, Next.js signals "this route is dynamic" by throwing here.
  const streamId = new URL(request.url).searchParams.get("stream") ?? "";
  try {
    await assertCanHost(await getDb(), await requireUser(), streamId);
    return Response.json(getProviders().video.broadcastConfig(streamId));
  } catch (error) {
    return errorResponse(error);
  }
}
