import "server-only";
import { providersEnv } from "../env";
import { createFakeOtp } from "./otp/fake";
import type { OtpSender } from "./otp/types";
import { createFakePayments } from "./payments/fake";
import { createRazorpayPayments } from "./payments/razorpay";
import type { PaymentProvider } from "./payments/types";
import { createFakeShipping } from "./shipping/fake";
import type { ShippingProvider } from "./shipping/types";
import { createFakeVideo } from "./video/fake";
import { createIvsVideo } from "./video/ivs";
import { createLocalVideo } from "./video/local";
import type { VideoProvider } from "./video/types";

export interface Providers {
  video: VideoProvider;
  payments: PaymentProvider;
  otp: OtpSender;
  shipping: ShippingProvider;
}

let providers: Providers | undefined;

/** Picks each provider from VIDEO_PROVIDER, PAYMENT_PROVIDER, etc. (stand-ins by default). */
export function getProviders(): Providers {
  if (providers) return providers;
  const env = providersEnv();
  providers = {
    video: createVideo(env.VIDEO_PROVIDER),
    payments: env.PAYMENT_PROVIDER === "razorpay" ? createRazorpayPayments() : createFakePayments(),
    otp: createFakeOtp(),
    shipping: createFakeShipping(),
  };
  return providers;
}

function createVideo(name: "ivs" | "fake" | "local"): VideoProvider {
  if (name === "ivs") return createIvsVideo();
  if (name === "fake") return createFakeVideo();
  if (process.env.NODE_ENV === "production") {
    throw new Error("VIDEO_PROVIDER=local is for development only. Use ivs in production.");
  }
  return createLocalVideo();
}

/** Lets tests swap in their own providers. */
export function setProvidersForTesting(override: Providers | undefined): void {
  providers = override;
}
