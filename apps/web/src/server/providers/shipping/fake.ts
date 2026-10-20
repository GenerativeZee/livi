import "server-only";
import { randomInt } from "node:crypto";
import type { ShippingProvider } from "./types";

/** Stand-in for Shiprocket: returns a made-up shipment and tracking number. */
export function createFakeShipping(): ShippingProvider {
  return {
    name: "fake",
    async createShipment({ orderId }) {
      return { shipmentId: `fakeship_${orderId}`, awb: `FAKE${randomInt(1e9, 1e10)}`, trackingUrl: null };
    },
  };
}
