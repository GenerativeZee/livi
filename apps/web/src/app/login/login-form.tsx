"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatIndianPhone, normalizeIndianPhone, type OtpRequestResponse } from "@stealth/shared";

export interface DemoAccount {
  label: string;
  phone: string;
}

type Step = { name: "phone" } | { name: "code"; phone: string; devCode?: string };

/** Only same-site paths, so a crafted link can't bounce users to another site after sign-in. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<Step>({ name: "phone" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    if (!normalizeIndianPhone(phone)) return setError("Enter a 10-digit Indian mobile number");
    setBusy(true);
    try {
      const sent = await postJson<OtpRequestResponse>("/api/auth/otp/request", { phone });
      setStep({ name: "code", phone: sent.phone, devCode: sent.devCode });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (step.name !== "code") return;
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/auth/otp/verify", { phone: step.phone, code });
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";
  const button = "w-full rounded-lg bg-pink-600 py-2.5 text-sm font-bold text-white disabled:opacity-50";

  if (step.name === "code") {
    return (
      <form onSubmit={verify} className="mt-6 flex flex-col gap-3">
        <p className="text-sm">
          Code sent to <span className="font-semibold">{formatIndianPhone(step.phone)}</span>{" "}
          <button type="button" onClick={() => setStep({ name: "phone" })} className="text-pink-600 underline">
            change
          </button>
        </p>
        {step.devCode && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Development: your code is <span className="font-mono font-bold">{step.devCode}</span>
          </p>
        )}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="6-digit code"
          className={`${input} tracking-[0.4em]`}
        />
        <button disabled={busy || code.length !== 6} className={button}>
          {busy ? "Checking…" : "Verify and sign in"}
        </button>
        <button type="button" onClick={() => sendCode()} disabled={busy} className="text-sm text-zinc-500 underline">
          Send a new code
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        placeholder="98765 43210"
        className={input}
      />
      <button disabled={busy || !phone} className={button}>
        {busy ? "Sending…" : "Send code"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {demoAccounts.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Demo accounts (development)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.label}
                type="button"
                onClick={() => setPhone(account.phone)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-left text-xs dark:border-zinc-700"
              >
                <span className="block font-semibold">{account.label}</span>
                <span className="text-zinc-500">{account.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
