import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentUser } from "@/server/session";
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
  const [featured, user] = await Promise.all([loadFeaturedStream(), currentUser()]);
  if (!featured.ok) return <SpikeNotConfigured error={featured.error} />;

  const { stream } = featured;
  if (!user || (!user.isAdmin && user.creatorId !== stream.creatorId)) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-lg font-semibold">{stream.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {user ? "This stream belongs to another creator. " : ""}
          Sign in with the creator&apos;s phone number to go live.
        </p>
        <Link href="/login?next=/spike/live" className="mt-4 inline-block rounded-lg bg-pink-600 px-4 py-2 text-sm font-bold text-white">
          Sign in as creator
        </Link>
      </main>
    );
  }

  return (
    <LiveClient streamId={stream.id} title={stream.title} products={featured.products} initialPinId={featured.initialPinId} />
  );
}
