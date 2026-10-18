export function SpikeNotConfigured({ error }: { error: unknown }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-lg font-semibold">Spike not configured</h1>
      <p className="mt-2 text-sm text-zinc-600">{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-4 text-sm text-zinc-600">
        See <code>apps/web/.env.example</code> and the Phase 0 section of the README.
      </p>
    </main>
  );
}
