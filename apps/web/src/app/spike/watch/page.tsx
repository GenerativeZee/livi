import { connection } from "next/server";
import { Suspense } from "react";
import { currentUser } from "@/server/session";
import { loadFeaturedStream } from "../load-featured";
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
  // Per request, not at build time: the stream, its pin and the provider config all change at runtime.
  await connection();
  const [featured, user] = await Promise.all([loadFeaturedStream(), currentUser()]);
  if (!featured.ok) return <SpikeNotConfigured error={featured.error} />;
  return (
    <WatchClient
      streamId={featured.stream.id}
      title={featured.stream.title}
      playback={featured.playback}
      products={featured.products}
      initialPinId={featured.initialPinId}
      signedIn={user !== null}
    />
  );
}
