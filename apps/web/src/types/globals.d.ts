import type * as IVS from "amazon-ivs-player";

// Both SDKs are loaded from their vendors' CDNs as globals.
// The IVS player's CDN build bundles its wasm worker, so `create()` needs no asset URLs.

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: "INR";
  name: string;
  description?: string;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

declare global {
  interface Window {
    IVSPlayer?: Omit<typeof IVS, "create"> & { create(): IVS.MediaPlayer };
    Razorpay?: new (options: RazorpayOptions) => { open(): void };
  }
  type RazorpayPaymentResponse = RazorpaySuccess;
}

export {};
