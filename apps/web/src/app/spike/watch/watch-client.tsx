"use client";

import { useCallback, useState } from "react";
import type { Playback, Product, StreamCue } from "@stealth/shared";
import { PinnedProduct } from "./pinned-product";
import { FakeVideo, IvsVideo, LocalVideo, type VideoStatus } from "./video";

interface Pin {
  product: Product;
  /** ms between the creator tapping "Pin" and this viewer seeing the card; null for a pin loaded with the page. */
  delayMs: number | null;
}

interface Props {
  streamId: string;
  title: string;
  playback: Playback;
  products: Product[];
  initialPinId: string | null;
  signedIn: boolean;
}

export function WatchClient({ streamId, title, playback, products, initialPinId, signedIn }: Props) {
  const [status, setStatus] = useState<VideoStatus>("loading");
  const [pin, setPin] = useState<Pin | null>(() => {
    const product = products.find((p) => p.id === initialPinId);
    return product ? { product, delayMs: null } : null;
  });

  const onCue = useCallback(
    (cue: StreamCue) => {
      if (cue.t === "unpin") return setPin(null);
      const product = products.find((p) => p.id === cue.productId);
      if (product) setPin({ product, delayMs: Date.now() - cue.sentAt });
    },
    [products],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-black text-white">
      <div className="relative flex-1">
        {playback.provider === "ivs" ? (
          <IvsVideo playbackUrl={playback.playbackUrl} onCue={onCue} onStatus={setStatus} />
        ) : playback.provider === "local" ? (
          <LocalVideo streamId={streamId} cuesUrl={playback.cuesUrl} onCue={onCue} onStatus={setStatus} />
        ) : (
          <FakeVideo cuesUrl={playback.cuesUrl} title={title} onCue={onCue} onStatus={setStatus} />
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2 text-xs font-semibold">
          {status === "playing" ? (
            <span className="rounded bg-red-600 px-2 py-1">
              LIVE{playback.provider === "fake" && " · simulated"}
              {playback.provider === "local" && " · local"}
            </span>
          ) : (
            <span className="rounded bg-white/20 px-2 py-1">
              {status === "unsupported" ? "Browser not supported" : status === "offline" ? "Waiting for creator…" : "Loading…"}
            </span>
          )}
          {pin?.delayMs != null && <span className="rounded bg-white/20 px-2 py-1">pin delay {(pin.delayMs / 1000).toFixed(1)}s</span>}
        </div>

        {pin && <PinnedProduct key={pin.product.id} streamId={streamId} product={pin.product} signedIn={signedIn} />}
      </div>
    </main>
  );
}
