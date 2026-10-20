import { RTC_HOST } from "@stealth/shared";
import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { getProviders } from "@/server/providers";
import { subscribeToSignals } from "@/server/providers/video/signal-bus";
import { requireUser } from "@/server/session";
import { assertCanHost } from "@/server/streams";

const Query = z.object({ stream: z.uuid(), peer: z.union([z.literal(RTC_HOST), z.uuid()]) });

/** Server-Sent Events feed of WebRTC signalling for one peer (dev-only "local" video provider). */
export async function GET(request: Request) {
  const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "expected ?stream=<id>&peer=host|<viewer id>" }, { status: 400 });
  if (getProviders().video.name !== "local") return Response.json({ error: "local video is off" }, { status: 404 });

  const { stream: streamId, peer } = query.data;
  try {
    // Listening as the host would let anyone receive viewers' connection requests.
    if (peer === RTC_HOST) await assertCanHost(await getDb(), await requireUser(), streamId);
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = subscribeToSignals(streamId, peer, (envelope) => send(`data: ${JSON.stringify(envelope)}\n\n`));
      const keepAlive = setInterval(() => send(": keep-alive\n\n"), 15_000);
      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
      send(": connected\n\n");
    },
    cancel: () => cleanup(),
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
