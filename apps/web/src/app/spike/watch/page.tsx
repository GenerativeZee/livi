import { connection } from "next/server";
import { Suspense } from "react";
import { DEMO_PRODUCTS } from "@stealth/shared";
import { ivsEnv } from "@/lib/env";
import { SpikeNotConfigured } from "../not-configured";
import { WatchClient } from "./watch-client";

export const metadata = { title: "Watch live · Spike" };

export default function WatchPage() {
  return (
    <Suspense>
      <Watch />
    </Suspense>
  );
}

async function Watch() {
  // Read env per request, not at build time, so a new channel only needs a restart.
  await connection();
  let playbackUrl: string;
  try {
    playbackUrl = ivsEnv().IVS_PLAYBACK_URL;
  } catch (error) {
    return <SpikeNotConfigured error={error} />;
  }
  return <WatchClient playbackUrl={playbackUrl} products={DEMO_PRODUCTS} />;
}
