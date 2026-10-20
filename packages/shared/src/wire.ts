import type { Split } from "./split";

// What the server tells the browser about each pluggable provider.
// Every union has a "fake" member used in development, so the app runs without third-party keys.

/** How the creator's device should broadcast. */
export type BroadcastConfig =
  | { provider: "ivs"; ingestEndpoint: string; streamKey: string }
  /** No video leaves the device; the creator sees a local camera preview only. */
  | { provider: "fake" };

/** How a viewer receives the stream and its pin cues. */
export type Playback =
  /** Video and cues both come through the IVS player (cues as timed metadata). */
  | { provider: "ivs"; playbackUrl: string }
  /** No video; cues arrive over Server-Sent Events from `cuesUrl`. */
  | { provider: "fake"; cuesUrl: string };

/** What the browser needs to collect payment for an order. */
export type CheckoutSession =
  | { provider: "razorpay"; keyId: string; paymentOrderId: string; amount: number }
  /** A stand-in payment sheet. Paying sends back `paymentId` + `payToken`, which prove the order came from our server. */
  | { provider: "fake"; paymentOrderId: string; amount: number; paymentId: string; payToken: string };

export interface CheckoutResponse {
  orderId: string;
  title: string;
  split: Split;
  session: CheckoutSession;
}

/** The fields the browser sends back after payment, named after Razorpay's so both providers share one route. */
export interface PaymentConfirmation {
  paymentOrderId: string;
  paymentId: string;
  signature: string;
}

export interface PaidOrderResponse {
  orderId: string;
  paymentId: string;
  split: Split;
}
