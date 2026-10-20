import { getProviders } from "@/server/providers";
import { isCreator, unauthorized } from "@/server/spike-auth";

/** Tells the creator page how to go live. The IVS stream key is a secret, so this is token-gated. */
export async function GET(request: Request) {
  if (!isCreator(request)) return unauthorized();
  const streamId = new URL(request.url).searchParams.get("stream") ?? "";
  return Response.json(getProviders().video.broadcastConfig(streamId));
}
