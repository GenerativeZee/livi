import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Split } from "@stealth/shared";
import { razorpayEnv } from "./env";

const API = "https://api.razorpay.com/v1";

interface Transfer {
  account: string;
  amount: number;
  currency: "INR";
  notes?: Record<string, string>;
  /** Hold until delivery + return window, then release; lets us reverse on returns. */
  on_hold: 0 | 1;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Creates a Razorpay order whose payment is split automatically by Razorpay Route:
 * the seller's and creator's shares go to their linked accounts, and the platform
 * keeps the rest (commission + TCS, minus gateway fees). We never hold buyer money ourselves.
 */
export async function createSplitOrder(split: Split, receipt: string): Promise<RazorpayOrder> {
  const env = razorpayEnv();
  const transfers: Transfer[] = [];
  if (env.RAZORPAY_SELLER_ACCOUNT_ID) {
    transfers.push({
      account: env.RAZORPAY_SELLER_ACCOUNT_ID,
      amount: split.seller,
      currency: "INR",
      notes: { role: "seller", receipt },
      on_hold: 1,
    });
  }
  if (env.RAZORPAY_CREATOR_ACCOUNT_ID && split.creatorCommission > 0) {
    transfers.push({
      account: env.RAZORPAY_CREATOR_ACCOUNT_ID,
      amount: split.creatorCommission,
      currency: "INR",
      notes: { role: "creator", receipt },
      on_hold: 1,
    });
  }

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: split.total,
      currency: "INR",
      receipt,
      ...(transfers.length > 0 && { transfers }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Checks the signature Checkout.js returns after payment.
 * Production must also confirm via the `payment.captured` webhook, since the browser can close before this runs.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", razorpayEnv().RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const razorpayKeyId = () => razorpayEnv().RAZORPAY_KEY_ID;
