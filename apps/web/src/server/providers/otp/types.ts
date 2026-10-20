export interface OtpSender {
  readonly name: "fake";
  /** Sends a one-time login code by SMS (or WhatsApp). Code generation and checking belong to the auth module. */
  send(phone: string, code: string): Promise<void>;
}
