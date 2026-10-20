"use client";

import Link from "next/link";
import Script from "next/script";
import { useState } from "react";
import {
  formatINR,
  type CheckoutResponse,
  type PaidOrderResponse,
  type PaymentConfirmation,
  type Product,
  type Split,
} from "@stealth/shared";

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type CheckoutState =
  | { step: "idle" }
  | { step: "busy" }
  /** Fake provider: our own test payment sheet is open. */
  | { step: "fake-sheet"; order: CheckoutResponse & { session: { provider: "fake" } } }
  | { step: "paid"; paymentId: string; split: Split }
  | { step: "error"; message: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

interface Props {
  streamId: string;
  product: Product;
  signedIn: boolean;
}

export function PinnedProduct({ streamId, product, signedIn }: Props) {
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.stock > 0)?.id ?? null);
  const [checkout, setCheckout] = useState<CheckoutState>({ step: "idle" });

  async function confirm(confirmation: PaymentConfirmation) {
    try {
      const paid = await postJson<PaidOrderResponse>("/api/spike/checkout/verify", confirmation);
      setCheckout({ step: "paid", paymentId: paid.paymentId, split: paid.split });
    } catch (e) {
      setCheckout({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function buy() {
    if (!variantId) return;
    setCheckout({ step: "busy" });
    let order: CheckoutResponse;
    try {
      order = await postJson<CheckoutResponse>("/api/spike/checkout", { streamId, productId: product.id, variantId });
    } catch (e) {
      return setCheckout({ step: "error", message: e instanceof Error ? e.message : "Could not start checkout" });
    }

    const { session } = order;
    if (session.provider === "fake") return setCheckout({ step: "fake-sheet", order: { ...order, session } });

    if (!window.Razorpay) return setCheckout({ step: "error", message: "Payment SDK still loading, try again" });
    new window.Razorpay({
      key: session.keyId,
      order_id: session.paymentOrderId,
      amount: session.amount,
      currency: "INR",
      name: "Stealth Live",
      description: order.title,
      theme: { color: "#db2777" },
      modal: { ondismiss: () => setCheckout({ step: "idle" }) },
      handler: (payment) =>
        confirm({
          paymentOrderId: payment.razorpay_order_id,
          paymentId: payment.razorpay_payment_id,
          signature: payment.razorpay_signature,
        }),
    }).open();
  }

  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-3 text-zinc-900 shadow-xl">
      <Script src={RAZORPAY_SRC} strategy="lazyOnload" />
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
      ) : checkout.step === "fake-sheet" ? (
        <FakePaymentSheet
          amount={checkout.order.session.amount}
          onPay={() => {
            const { paymentOrderId, paymentId, payToken } = checkout.order.session;
            setCheckout({ step: "busy" });
            confirm({ paymentOrderId, paymentId, signature: payToken });
          }}
          onCancel={() => setCheckout({ step: "idle" })}
        />
      ) : !signedIn ? (
        <Link
          href="/login?next=/spike/watch"
          className="mt-3 block w-full rounded-xl bg-pink-600 py-2.5 text-center text-sm font-bold text-white"
        >
          Sign in to buy
        </Link>
      ) : (
        <button
          onClick={buy}
          disabled={!variantId || checkout.step === "busy"}
          className="mt-3 w-full rounded-xl bg-pink-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {checkout.step === "busy" ? "Processing…" : variantId ? "Buy now" : "Sold out"}
        </button>
      )}
      {checkout.step === "error" && <p className="mt-2 text-xs text-red-600">{checkout.message}</p>}
    </div>
  );
}

/** Stands in for the Razorpay sheet when PAYMENT_PROVIDER=fake. */
function FakePaymentSheet({ amount, onPay, onCancel }: { amount: number; onPay: () => void; onCancel: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Test payment · no money moves</p>
      <p className="mt-1 text-lg font-bold">{formatINR(amount)}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={onPay} className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-bold text-white">
          Pay (test)
        </button>
        <button onClick={onCancel} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
