import type { Paise } from "./money";

// Shapes shared by the web app, the creator app and the API.
// The database schema in @stealth/db is the source of truth for storage; these are the wire types.

export type Locale = "en" | "hi";

export type SellerStatus = "pending_kyc" | "approved" | "rejected" | "suspended";

export type StreamStatus = "scheduled" | "live" | "ended";

export type OrderStatus =
  | "created"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "returned";

export interface ProductVariant {
  id: string;
  /** e.g. "M", "Free size", "40" */
  label: string;
  stock: number;
}

export interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  imageUrls: string[];
  price: Paise;
  /** Original price for showing a discount; omitted when not on sale. */
  mrp?: Paise;
  gstBps: number;
  variants: ProductVariant[];
}

export interface LiveStream {
  id: string;
  creatorId: string;
  title: string;
  status: StreamStatus;
  scheduledAt: string;
  playbackUrl: string;
  productIds: string[];
}
