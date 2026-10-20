import "server-only";
import type { Playback, Product } from "@stealth/shared";
import { getCurrentPin, getFeaturedStream, getStreamLineup } from "@/server/catalog";
import { getDb } from "@/server/db";
import { getProviders } from "@/server/providers";

export type FeaturedStream =
  | {
      ok: true;
      stream: { id: string; title: string; creatorId: string };
      products: Product[];
      initialPinId: string | null;
      playback: Playback;
    }
  | { ok: false; error: unknown };

/** Everything both spike pages need about the featured stream, or the reason it couldn't be loaded. */
export async function loadFeaturedStream(): Promise<FeaturedStream> {
  try {
    const db = await getDb();
    const stream = await getFeaturedStream(db);
    if (!stream) return { ok: false, error: "No upcoming or live stream in the database." };
    const [products, initialPinId] = await Promise.all([getStreamLineup(db, stream.id), getCurrentPin(db, stream.id)]);
    return { ok: true, stream, products, initialPinId, playback: getProviders().video.playback(stream.id) };
  } catch (error) {
    return { ok: false, error };
  }
}
