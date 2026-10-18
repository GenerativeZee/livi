import Link from "next/link";

const SPIKES = [
  {
    href: "/spike/live",
    title: "1 · Go live",
    body: "Creator broadcasts from a phone browser into AWS IVS, then pins products during the stream.",
  },
  {
    href: "/spike/watch",
    title: "2 · Watch & buy",
    body: "Shopper player. Pinned products appear in sync with the video, with Razorpay checkout and a split preview.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-bold">Phase 0 spikes</h1>
      <p className="mt-2 text-sm text-zinc-500">Open “Go live” on a phone and “Watch &amp; buy” on another device.</p>
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
