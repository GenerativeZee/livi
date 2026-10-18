import { z } from "zod";

/**
 * Messages the server injects into the live video via IVS timed metadata.
 * They arrive in the player in sync with the frame the creator was on,
 * so every viewer sees the product card at the same moment in the video.
 *
 * IVS caps each metadata payload at 1 KB, so keep these small: send ids, not product details.
 * `sentAt` (epoch ms) lets the player measure tap-to-screen delay, which is mostly the video latency itself.
 */
export const StreamCue = z.discriminatedUnion("t", [
  z.object({ t: z.literal("pin"), productId: z.string().max(64), sentAt: z.number().int() }),
  z.object({ t: z.literal("unpin"), sentAt: z.number().int() }),
]);
export type StreamCue = z.infer<typeof StreamCue>;

export const IVS_METADATA_MAX_BYTES = 1024;

export function encodeCue(cue: StreamCue): string {
  const text = JSON.stringify(StreamCue.parse(cue));
  if (new TextEncoder().encode(text).length > IVS_METADATA_MAX_BYTES) {
    throw new Error("stream cue exceeds IVS 1 KB metadata limit");
  }
  return text;
}

/** Returns null for anything that isn't one of our cues, so stray metadata never breaks the player. */
export function decodeCue(text: string): StreamCue | null {
  try {
    const result = StreamCue.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
