import { RTC_ALL_VIEWERS, RTC_HOST } from "@stealth/shared";
import { z } from "zod";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { getProviders } from "@/server/providers";
import { publishSignal } from "@/server/providers/video/signal-bus";
import { requireUser } from "@/server/session";
import { assertCanHost } from "@/server/streams";

const Signal = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("host-ready") }),
  z.object({ kind: z.literal("join") }),
  z.object({ kind: z.literal("offer"), sdp: z.string().max(20_000) }),
  z.object({ kind: z.literal("answer"), sdp: z.string().max(20_000) }),
  z.object({
    kind: z.literal("ice"),
    candidate: z.object({
      candidate: z.string().max(1_000),
      sdpMid: z.string().max(64).nullish(),
      sdpMLineIndex: z.number().int().min(0).max(64).nullish(),
    }),
  }),
  z.object({ kind: z.literal("leave") }),
]);

const viewer = z.uuid();
const Body = z.object({
  streamId: z.uuid(),
  from: z.union([z.literal(RTC_HOST), viewer]),
  to: z.union([z.literal(RTC_HOST), z.literal(RTC_ALL_VIEWERS), viewer]),
  signal: Signal,
});

/** Relays one WebRTC signalling message (dev-only "local" video provider). */
export async function POST(request: Request) {
  // sendBeacon posts text/plain, so parse the body as JSON whatever its content type.
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid signal" }, { status: 400 });
  if (getProviders().video.name !== "local") return Response.json({ error: "local video is off" }, { status: 404 });

  const envelope = body.data;
  try {
    if (envelope.from === RTC_HOST) {
      await assertCanHost(await getDb(), await requireUser(), envelope.streamId);
    } else if (envelope.to !== RTC_HOST) {
      // Viewers only ever talk to the host, never to each other.
      return Response.json({ error: "viewers can only signal the host" }, { status: 403 });
    }
  } catch (error) {
    return errorResponse(error);
  }

  publishSignal(envelope.streamId, { from: envelope.from, to: envelope.to, signal: envelope.signal });
  return Response.json({ ok: true });
}
