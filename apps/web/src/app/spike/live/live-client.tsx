"use client";

import { useEffect, useRef, useState } from "react";
import type { AmazonIVSBroadcastClient } from "amazon-ivs-web-broadcast";
import { formatINR, type BroadcastConfig, type Product } from "@stealth/shared";

const TOKEN_HEADER = "x-creator-token";

type Phase = "signed-out" | "preview" | "live";

interface Props {
  streamId: string;
  title: string;
  products: Product[];
  initialPinId: string | null;
}

export function LiveClient({ streamId, title, products, initialPinId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<AmazonIVSBroadcastClient | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const configRef = useRef<BroadcastConfig | null>(null);

  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>("signed-out");
  const [provider, setProvider] = useState<BroadcastConfig["provider"] | null>(null);
  const [connection, setConnection] = useState("idle");
  const [pinnedId, setPinnedId] = useState<string | null>(initialPinId);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      clientRef.current?.stopBroadcast();
      clientRef.current?.delete();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function startPreview() {
    setError(null);
    try {
      const res = await fetch(`/api/spike/broadcast?stream=${encodeURIComponent(streamId)}`, { headers: { [TOKEN_HEADER]: token } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not load stream settings");
      const config: BroadcastConfig = await res.json();
      configRef.current = config;
      setProvider(config.provider);

      if (config.provider === "fake") {
        await startFakePreview();
      } else {
        await startIvsPreview(config.ingestEndpoint);
      }
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /** No video leaves the device. The camera preview is optional, so pins can be tested on a machine without one. */
  async function startFakePreview() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      mediaRef.current = media;
      if (previewRef.current) previewRef.current.srcObject = media;
      setConnection("local preview");
    } catch {
      setConnection("no camera");
    }
  }

  async function startIvsPreview(ingestEndpoint: string) {
    // Loaded on demand: the SDK touches browser APIs at import time.
    const { default: IVSBroadcastClient } = await import("amazon-ivs-web-broadcast");
    if (!IVSBroadcastClient.isSupported()) throw new Error("This browser can't broadcast. Try Chrome or Safari.");

    // Portrait: shoppers watch on phones, and clothes read better full-length.
    const client = IVSBroadcastClient.create({ streamConfig: IVSBroadcastClient.STANDARD_PORTRAIT, ingestEndpoint });
    client.on(IVSBroadcastClient.BroadcastClientEvents.CONNECTION_STATE_CHANGE, () => setConnection(client.getConnectionState()));

    const { width, height } = IVSBroadcastClient.STANDARD_PORTRAIT.maxResolution;
    const media = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: width }, height: { ideal: height } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    await client.addVideoInputDevice(new MediaStream(media.getVideoTracks()), "camera", { index: 0 });
    await client.addAudioInputDevice(new MediaStream(media.getAudioTracks()), "mic");
    if (canvasRef.current) client.attachPreview(canvasRef.current);

    clientRef.current = client;
    mediaRef.current = media;
  }

  async function goLive() {
    setError(null);
    try {
      const config = configRef.current;
      if (config?.provider === "ivs") await clientRef.current?.startBroadcast(config.streamKey);
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function endLive() {
    clientRef.current?.stopBroadcast();
    setPhase("preview");
    if (pinnedId) pin(null);
  }

  async function pin(productId: string | null) {
    setError(null);
    const res = await fetch("/api/spike/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json", [TOKEN_HEADER]: token },
      body: JSON.stringify({ streamId, productId }),
    });
    if (res.ok) setPinnedId(productId);
    else setError((await res.json().catch(() => null))?.error ?? `Pin failed (${res.status})`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 bg-zinc-950 p-3 text-white">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-zinc-800">
        {provider === "fake" ? (
          <video ref={previewRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <canvas ref={canvasRef} className="h-full w-full object-cover" />
        )}
        <div className="absolute left-3 top-3 flex gap-2 text-xs font-semibold">
          {phase === "live" && <span className="rounded bg-red-600 px-2 py-1">LIVE{provider === "fake" && " · simulated"}</span>}
          {phase !== "signed-out" && <span className="rounded bg-white/20 px-2 py-1">{connection}</span>}
        </div>
        {phase === "signed-out" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold">{title}</p>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Creator token"
              className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm"
            />
            <button onClick={startPreview} disabled={!token} className="w-full rounded-lg bg-white py-2 text-sm font-bold text-black disabled:opacity-50">
              Start camera
            </button>
          </div>
        )}
      </div>

      {phase === "preview" && (
        <button onClick={goLive} className="rounded-xl bg-red-600 py-3 font-bold">
          Go live
        </button>
      )}
      {phase === "live" && (
        <button onClick={endLive} className="rounded-xl bg-zinc-700 py-3 font-bold">
          End stream
        </button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {phase === "live" && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-400">Products: tap to pin for viewers</h2>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => pin(p.id === pinnedId ? null : p.id)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                p.id === pinnedId ? "bg-pink-600" : "bg-zinc-800"
              }`}
            >
              <span className="truncate">{p.title}</span>
              <span className="ml-2 shrink-0 text-xs">{p.id === pinnedId ? "Unpin" : formatINR(p.price)}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
