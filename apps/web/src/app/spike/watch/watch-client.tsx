"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeCue, formatINR, type Product, type Split } from "@stealth/shared";

const IVS_PLAYER_SRC = "https://player.live-video.net/1.57.0/amazon-ivs-player.min.js";
const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type PlayerStatus = "loading" | "offline" | "playing" | "unsupported";

interface Pin {
  product: Product;
  /** ms between the creator tapping "Pin" and this viewer seeing the card. */
  delayMs: number;
}

export function WatchClient({ playbackUrl, products }: { playbackUrl: string; products: Product[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [muted, setMuted] = useState(true);
  const [pin, setPin] = useState<Pin | null>(null);

  useEffect(() => {
    const IVSPlayer = window.IVSPlayer;
    const video = videoRef.current;
    if (!playerReady || !IVSPlayer || !video) return;

    const player = IVSPlayer.create();
    player.attachHTMLVideoElement(video);
    player.setMuted(true); // browsers only autoplay muted video
    player.setAutoplay(true);

    const { PlayerState, PlayerEventType } = IVSPlayer;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => player.load(playbackUrl);

    player.addEventListener(PlayerState.PLAYING, () => setStatus("playing"));
    player.addEventListener(PlayerState.ENDED, () => setStatus("offline"));
    // A channel that isn't live yet returns an error; keep polling so the page picks the stream up when it starts.
    player.addEventListener(PlayerEventType.ERROR, () => {
      setStatus("offline");
      retry = setTimeout(load, 5000);
    });
    player.addEventListener(PlayerEventType.TEXT_METADATA_CUE, (cue) => {
      const decoded = decodeCue(cue.text);
      if (!decoded) return;
      if (decoded.t === "unpin") return setPin(null);
      const product = products.find((p) => p.id === decoded.productId);
      if (product) setPin({ product, delayMs: Date.now() - decoded.sentAt });
    });

    load();
    return () => {
      clearTimeout(retry);
      player.delete();
    };
  }, [playerReady, playbackUrl, products]);

  const onPlayerScript = () => {
    if (window.IVSPlayer?.isPlayerSupported) setPlayerReady(true);
    else setStatus("unsupported");
  };

  const unmute = () => {
    if (videoRef.current) videoRef.current.muted = false;
    setMuted(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-black text-white">
      <Script src={IVS_PLAYER_SRC} strategy="afterInteractive" onReady={onPlayerScript} />
      <Script src={RAZORPAY_SRC} strategy="lazyOnload" />

      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute left-3 top-3 flex items-center gap-2 text-xs font-semibold">
          {status === "playing" ? (
            <span className="rounded bg-red-600 px-2 py-1">LIVE</span>
          ) : (
            <span className="rounded bg-white/20 px-2 py-1">
              {status === "unsupported" ? "Browser not supported" : status === "offline" ? "Waiting for creator…" : "Loading…"}
            </span>
          )}
          {pin && <span className="rounded bg-white/20 px-2 py-1">pin delay {(pin.delayMs / 1000).toFixed(1)}s</span>}
        </div>

        {status === "playing" && muted && (
          <button onClick={unmute} className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            Tap for sound
          </button>
        )}

        {pin && <PinnedProduct key={pin.product.id} product={pin.product} />}
      </div>
    </main>
  );
}

type CheckoutState =
  | { step: "idle" }
  | { step: "busy" }
  | { step: "paid"; paymentId: string; split: Split }
  | { step: "error"; message: string };

function PinnedProduct({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.stock > 0)?.id ?? null);
  const [checkout, setCheckout] = useState<CheckoutState>({ step: "idle" });

  const buy = useCallback(async () => {
    if (!variantId) return;
    if (!window.Razorpay) return setCheckout({ step: "error", message: "Payment SDK still loading, try again" });
    setCheckout({ step: "busy" });

    const res = await fetch("/api/spike/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, variantId }),
    });
    const order = await res.json();
    if (!res.ok) return setCheckout({ step: "error", message: order.error ?? "Could not start checkout" });

    new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      name: "Stealth Live",
      description: order.title,
      theme: { color: "#db2777" },
      modal: { ondismiss: () => setCheckout({ step: "idle" }) },
      handler: async (payment) => {
        const verify = await fetch("/api/spike/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payment),
        });
        const result = await verify.json();
        setCheckout(
          result.verified
            ? { step: "paid", paymentId: result.paymentId, split: order.split }
            : { step: "error", message: "Payment signature did not verify" },
        );
      },
    }).open();
  }, [product.id, variantId]);

  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-3 text-zinc-900 shadow-xl">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote demo images, no loader configured in the spike */}
        <img src={product.imageUrls[0]} alt="" className="h-20 w-16 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{product.title}</p>
          <p className="mt-1 text-sm">
            <span className="font-bold">{formatINR(product.price)}</span>
            {product.mrp && <span className="ml-2 text-xs text-zinc-500 line-through">{formatINR(product.mrp)}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {product.variants.map((v) => (
              <button
                key={v.id}
                disabled={v.stock < 1}
                onClick={() => setVariantId(v.id)}
                className={`rounded-md border px-2 py-0.5 text-xs disabled:opacity-30 ${
                  v.id === variantId ? "border-pink-600 bg-pink-50 text-pink-700" : "border-zinc-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {checkout.step === "paid" ? (
        <div className="mt-3 rounded-lg bg-green-50 p-2 text-xs text-green-800">
          <p className="font-semibold">Paid · {checkout.paymentId}</p>
          <p className="mt-1">
            Seller {formatINR(checkout.split.seller)} · Creator {formatINR(checkout.split.creatorCommission)} · Platform{" "}
            {formatINR(checkout.split.platformCommission)} · TCS {formatINR(checkout.split.tcs)}
          </p>
        </div>
      ) : (
        <button
          onClick={buy}
          disabled={!variantId || checkout.step === "busy"}
          className="mt-3 w-full rounded-xl bg-pink-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {checkout.step === "busy" ? "Opening payment…" : variantId ? "Buy now" : "Sold out"}
        </button>
      )}
      {checkout.step === "error" && <p className="mt-2 text-xs text-red-600">{checkout.message}</p>}
    </div>
  );
}
