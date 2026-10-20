import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { safeEqual } from "../safe-equal";
import type { PaymentProvider } from "./types";

// A fresh secret per server process: fake payments can't be forged, and don't survive a restart (nor does the in-memory DB).
// Kept on globalThis so the checkout and verify routes share it even when Next.js loads them as separate modules.
const globalForSecret = globalThis as unknown as { fakePaymentSecret?: Buffer };
const secret = (globalForSecret.fakePaymentSecret ??= randomBytes(32));
const sign = (paymentOrderId: string) => createHmac("sha256", secret).update(paymentOrderId).digest("hex");

const fakePaymentId = (paymentOrderId: string) => `fakepay_${paymentOrderId.slice("fakeorder_".length)}`;

/**
 * Stand-in for Razorpay. The browser shows a "Pay (test)" sheet and confirms with the token issued here,
 * so the server-side flow (order → verify → mark paid) is exactly the one real payments use.
 */
export function createFakePayments(): PaymentProvider {
  return {
    name: "fake",
    async createPayment({ split }) {
      const paymentOrderId = `fakeorder_${randomUUID()}`;
      return {
        provider: "fake",
        paymentOrderId,
        amount: split.total,
        paymentId: fakePaymentId(paymentOrderId),
        payToken: sign(paymentOrderId),
      };
    },
    verifyPayment(paymentOrderId, paymentId, signature) {
      return paymentId === fakePaymentId(paymentOrderId) && safeEqual(sign(paymentOrderId), signature);
    },
  };
}
