import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { streamPins, type Db } from "@stealth/db";
import type { SessionUser } from "@stealth/shared";
import { isInLineup } from "./catalog";
import { AppError } from "./errors";
import type { VideoProvider } from "./providers/video/types";
import { assertCanHost } from "./streams";

/**
 * Pins a product for every viewer (or unpins with null). The pin is recorded first,
 * so viewers who join later still see it and analytics can attribute sales to it.
 */
export async function setPin(
  db: Db,
  video: VideoProvider,
  actor: SessionUser,
  streamId: string,
  productId: string | null,
): Promise<number> {
  await assertCanHost(db, actor, streamId);
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
