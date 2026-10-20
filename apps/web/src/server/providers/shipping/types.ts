export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface CreateShipmentInput {
  orderId: string;
  pickupSellerId: string;
  to: ShippingAddress;
  items: { title: string; quantity: number; unitPricePaise: number }[];
  weightGrams: number;
}

export interface Shipment {
  shipmentId: string;
  /** Courier tracking number (air waybill). */
  awb: string;
  trackingUrl: string | null;
}

export interface ShippingProvider {
  readonly name: "fake";
  createShipment(input: CreateShipmentInput): Promise<Shipment>;
}
