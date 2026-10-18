import { ivsEnv } from "@/lib/env";
import { isCreator, unauthorized } from "@/lib/spike-auth";

/** Gives the creator page what it needs to go live. The stream key is a secret, so this is token-gated. */
export async function GET(request: Request) {
  if (!isCreator(request)) return unauthorized();
  const env = ivsEnv();
  return Response.json({ ingestEndpoint: env.IVS_INGEST_ENDPOINT, streamKey: env.IVS_STREAM_KEY });
}
