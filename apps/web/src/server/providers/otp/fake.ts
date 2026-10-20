import "server-only";
import type { OtpSender } from "./types";

/** Prints login codes to the server terminal instead of sending an SMS. */
export function createFakeOtp(): OtpSender {
  return {
    name: "fake",
    async send(phone, code) {
      console.log(`[fake-otp] login code for ${phone}: ${code}`);
    },
  };
}
