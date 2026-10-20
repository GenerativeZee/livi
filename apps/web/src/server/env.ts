import "server-only";
import { z } from "zod";

// Every provider defaults to a stand-in ("fake", or "local" for video), so the app runs with no third-party keys.
// Switching one to its real implementation only requires that provider's own variables.

const required = z.string().min(1);

const providersSchema = z.object({
  // Defaults to "local" (browser-to-browser video) in development and "fake" (no video) in production.
  VIDEO_PROVIDER: z
    .enum(["local", "fake", "ivs"])
    .default(process.env.NODE_ENV === "production" ? "fake" : "local"),
  PAYMENT_PROVIDER: z.enum(["fake", "razorpay"]).default("fake"),
  OTP_PROVIDER: z.enum(["fake"]).default("fake"),
  SHIPPING_PROVIDER: z.enum(["fake"]).default("fake"),
});

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
});

const seedSchema = z.object({
  // Razorpay Route linked accounts (acc_...) attached to the demo seller and creator when the dev database is seeded.
  RAZORPAY_SELLER_ACCOUNT_ID: z.string().optional(),
  RAZORPAY_CREATOR_ACCOUNT_ID: z.string().optional(),
});

function load<T extends z.ZodType>(schema: T, name: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`${name} is not configured. Check apps/web/.env.local: ${problems}`);
  }
  return result.data;
}

export const providersEnv = () => load(providersSchema, "Provider selection");
export const ivsEnv = () => load(ivsSchema, "AWS IVS");
export const razorpayEnv = () => load(razorpaySchema, "Razorpay");
export const seedEnv = () => load(seedSchema, "Seed data");

/** Showing login codes on screen is only allowed with the fake SMS sender, outside production. */
export const showDevOtpCodes = () => process.env.NODE_ENV !== "production" && providersEnv().OTP_PROVIDER === "fake";
