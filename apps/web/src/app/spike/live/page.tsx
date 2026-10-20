import { connection } from "next/server";
import { Suspense } from "react";
import { loadFeaturedStream } from "../load-featured";
import { SpikeNotConfigured } from "../not-configured";
import { LiveClient } from "./live-client";

export const metadata = { title: "Go live · Spike" };

export default function LivePage() {
  return (
    <Suspense>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  const featured = await loadFeaturedStream();
  if (!featured.ok) return <SpikeNotConfigured error={featured.error} />;
  return (
    <LiveClient
      streamId={featured.stream.id}
      title={featured.stream.title}
      products={featured.products}
      initialPinId={featured.initialPinId}
    />
  );
}
