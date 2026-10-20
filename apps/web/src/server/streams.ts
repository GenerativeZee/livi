import "server-only";
import { eq } from "drizzle-orm";
import { liveStreams, type Db } from "@stealth/db";
import type { SessionUser } from "@stealth/shared";
import { AppError } from "./errors";

/** Only the stream's own creator (or an admin) may broadcast to it or pin products. */
export async function assertCanHost(db: Db, user: SessionUser, streamId: string): Promise<void> {
  const [stream] = await db.select({ creatorId: liveStreams.creatorId }).from(liveStreams).where(eq(liveStreams.id, streamId));
  if (!stream) throw new AppError(404, "Unknown stream");
  if (!user.isAdmin && user.creatorId !== stream.creatorId) {
    throw new AppError(403, "Only this stream's creator can do that");
  }
}
