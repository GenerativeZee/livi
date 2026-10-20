import type { CheckoutSession, Split } from "@stealth/shared";

export interface CreatePaymentInput {
  split: Split;
  /** Our order id, shown in the provider's dashboard. */
  receipt: string;
  /** Linked accounts that receive their share automatically. Missing accounts mean no split for that party. */
  sellerAccountId?: string | null;
  creatorAccountId?: string | null;
}

export interface PaymentProvider {
  readonly name: "razorpay" | "fake";
  createPayment(input: CreatePaymentInput): Promise<CheckoutSession>;
  /** Checks that the browser's confirmation really came from the provider for this order. */
  verifyPayment(paymentOrderId: string, paymentId: string, signature: string): boolean;
}
