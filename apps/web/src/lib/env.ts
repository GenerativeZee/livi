import "server-only";
import { z } from "zod";

// Each spike validates only the variables it needs, so the IVS spike runs
// without Razorpay keys and vice versa.

const required = z.string().min(1);

const ivsSchema = z.object({
  AWS_REGION: required,
  IVS_CHANNEL_ARN: required,
  IVS_INGEST_ENDPOINT: required,
  IVS_STREAM_KEY: required,
  IVS_PLAYBACK_URL: required,
});

const razorpaySchema = z.object({
  RAZORPAY_KEY_ID: required,
  RAZORPAY_KEY_SECRET: required,
  // Razorpay Route linked accounts (acc_...). Leave unset to test a plain checkout without splits.
  RAZORPAY_SELLER_ACCOUNT_ID: z.string().optional(),
  RAZORPAY_CREATOR_ACCOUNT_ID: z.string().optional(),
});

function load<T extends z.ZodType>(schema: T, name: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`${name} spike is not configured. Missing in apps/web/.env.local: ${missing}`);
  }
  return result.data;
}

export const ivsEnv = () => load(ivsSchema, "IVS");
export const razorpayEnv = () => load(razorpaySchema, "Razorpay");

/** Shared secret the creator enters on the broadcast page; guards the stream key and pin API. */
export const creatorToken = () => load(z.object({ SPIKE_CREATOR_TOKEN: z.string().min(8) }), "Creator").SPIKE_CREATOR_TOKEN;
