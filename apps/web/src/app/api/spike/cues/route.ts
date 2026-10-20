import { encodeCue } from "@stealth/shared";
import { subscribeToCues } from "@/server/providers/video/cue-bus";

/** Server-Sent Events feed of pin cues, used by the fake and local video providers in place of IVS timed metadata. */
export async function GET(request: Request) {
  const streamId = new URL(request.url).searchParams.get("stream");
  if (!streamId) return Response.json({ error: "missing ?stream=" }, { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = subscribeToCues(streamId, (cue) => send(`data: ${encodeCue(cue)}\n\n`));
      // Comment lines keep proxies from closing an idle connection.
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
