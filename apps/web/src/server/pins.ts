import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { liveStreams, streamPins, type Db } from "@stealth/db";
import { isInLineup } from "./catalog";
import { AppError } from "./errors";
import type { VideoProvider } from "./providers/video/types";

/**
 * Pins a product for every viewer (or unpins with null). The pin is recorded first,
 * so viewers who join later still see it and analytics can attribute sales to it.
 */
export async function setPin(db: Db, video: VideoProvider, streamId: string, productId: string | null): Promise<number> {
  const [stream] = await db.select({ id: liveStreams.id }).from(liveStreams).where(eq(liveStreams.id, streamId));
  if (!stream) throw new AppError(404, "Unknown stream");
  if (productId && !(await isInLineup(db, streamId, productId))) {
    throw new AppError(404, "That product isn't in this stream's lineup");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(streamPins)
      .set({ unpinnedAt: new Date() })
      .where(and(eq(streamPins.streamId, streamId), isNull(streamPins.unpinnedAt)));
    if (productId) await tx.insert(streamPins).values({ streamId, productId });
  });

  const sentAt = Date.now();
  await video.sendCue(streamId, productId ? { t: "pin", productId, sentAt } : { t: "unpin", sentAt });
  return sentAt;
}
