import "server-only";
import { createHmac } from "node:crypto";
import { razorpayEnv } from "../../env";
import { safeEqual } from "../safe-equal";
import type { PaymentProvider } from "./types";

const API = "https://api.razorpay.com/v1";

interface Transfer {
  account: string;
  amount: number;
  currency: "INR";
  notes?: Record<string, string>;
  /** Hold until delivery + return window, then release; lets us reverse on returns. */
  on_hold: 0 | 1;
}

/**
 * Razorpay with Route: the seller's and creator's shares go to their linked accounts automatically,
 * and the platform keeps the rest (commission + TCS, minus gateway fees). We never hold buyer money ourselves.
 */
export function createRazorpayPayments(): PaymentProvider {
  const env = razorpayEnv();
  const auth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

  return {
    name: "razorpay",

    async createPayment({ split, receipt, sellerAccountId, creatorAccountId }) {
      const transfers: Transfer[] = [];
      if (sellerAccountId) {
        transfers.push({ account: sellerAccountId, amount: split.seller, currency: "INR", notes: { role: "seller", receipt }, on_hold: 1 });
      }
      if (creatorAccountId && split.creatorCommission > 0) {
        transfers.push({
          account: creatorAccountId,
          amount: split.creatorCommission,
          currency: "INR",
          notes: { role: "creator", receipt },
          on_hold: 1,
        });
      }

      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: split.total, currency: "INR", receipt, ...(transfers.length > 0 && { transfers }) }),
      });
      if (!res.ok) {
        throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
      }
      const order: { id: string; amount: number } = await res.json();
      return { provider: "razorpay", keyId: env.RAZORPAY_KEY_ID, paymentOrderId: order.id, amount: order.amount };
    },

    // Production must also confirm via the `payment.captured` webhook, since the browser can close before this runs.
    verifyPayment(paymentOrderId, paymentId, signature) {
      const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${paymentOrderId}|${paymentId}`).digest("hex");
      return safeEqual(expected, signature);
    },
  };
}
