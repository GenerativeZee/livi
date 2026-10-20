import Link from "next/link";
import { Suspense } from "react";
import { AccountBar } from "./account-bar";

const SPIKES = [
  {
    href: "/spike/live",
    title: "1 · Go live",
    body: "Sign in as the creator, broadcast, and pin products during the stream.",
  },
  {
    href: "/spike/watch",
    title: "2 · Watch & buy",
    body: "Shopper view. Pinned products appear in sync with the video; sign in to buy.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Phase 0 spikes</h1>
        <Suspense>
          <AccountBar />
        </Suspense>
      </div>
      <p className="mt-2 text-sm text-zinc-500">Open “Go live” and “Watch &amp; buy” in two windows, signed in as different people.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {SPIKES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-xl border border-zinc-200 p-4 hover:border-pink-500 dark:border-zinc-800">
              <p className="font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{s.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
