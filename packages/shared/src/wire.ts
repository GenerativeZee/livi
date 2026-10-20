import type { Split } from "./split";

// What the server tells the browser about each pluggable provider.
// Every union has a "fake" member used in development, so the app runs without third-party keys.

/** How the creator's device should broadcast. */
export type BroadcastConfig =
  | { provider: "ivs"; ingestEndpoint: string; streamKey: string }
  /** No video leaves the device; the creator sees a local camera preview only. */
  | { provider: "fake" }
  /** Development: video goes browser-to-browser over WebRTC, set up through our signalling routes. */
  | { provider: "local" };

/** How a viewer receives the stream and its pin cues. */
export type Playback =
  /** Video and cues both come through the IVS player (cues as timed metadata). */
  | { provider: "ivs"; playbackUrl: string }
  /** No video; cues arrive over Server-Sent Events from `cuesUrl`. */
  | { provider: "fake"; cuesUrl: string }
  /** Development: video straight from the creator's browser over WebRTC; cues as with "fake". */
  | { provider: "local"; cuesUrl: string };

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

/** Who is signed in, and what they're allowed to do. Roles come from data, not a role column. */
export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  isAdmin: boolean;
  /** Set when the user has a creator profile. */
  creatorId: string | null;
  /** Seller accounts the user owns (usually zero or one). */
  sellerIds: string[];
}

export interface OtpRequestResponse {
  phone: string;
  expiresInSeconds: number;
  /** Only in development with the fake SMS provider, so the login screen can show the code. */
  devCode?: string;
}

/**
 * WebRTC signalling for the dev-only "local" video provider: the server relays these between
 * the creator ("host") and each viewer so their browsers can connect directly.
 */
export type RtcSignal =
  /** Host → all viewers: the host just went live; viewers should (re)ask to connect. */
  | { kind: "host-ready" }
  /** Viewer → host: please send me your video. */
  | { kind: "join" }
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } }
  /** Either side: this connection is over. */
  | { kind: "leave" };

/** "host", "viewers" (every viewer), or one viewer's random id. */
export type RtcPeer = string;

export interface RtcEnvelope {
  from: RtcPeer;
  to: RtcPeer;
  signal: RtcSignal;
}

export const RTC_HOST = "host";
export const RTC_ALL_VIEWERS = "viewers";
