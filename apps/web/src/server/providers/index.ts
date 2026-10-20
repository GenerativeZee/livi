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
import type { VideoProvider } from "./video/types";

export interface Providers {
  video: VideoProvider;
  payments: PaymentProvider;
  otp: OtpSender;
  shipping: ShippingProvider;
}

let providers: Providers | undefined;

/** Picks each provider from VIDEO_PROVIDER, PAYMENT_PROVIDER, etc. (all "fake" by default). */
export function getProviders(): Providers {
  if (providers) return providers;
  const env = providersEnv();
  providers = {
    video: env.VIDEO_PROVIDER === "ivs" ? createIvsVideo() : createFakeVideo(),
    payments: env.PAYMENT_PROVIDER === "razorpay" ? createRazorpayPayments() : createFakePayments(),
    otp: createFakeOtp(),
    shipping: createFakeShipping(),
  };
  return providers;
}

/** Lets tests swap in their own providers. */
export function setProvidersForTesting(override: Providers | undefined): void {
  providers = override;
}
