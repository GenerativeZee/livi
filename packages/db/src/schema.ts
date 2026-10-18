import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Conventions: all money columns are integer paise and end in `_paise`.
// Percentages are integer basis points and end in `_bps`.

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const localeEnum = pgEnum("locale", ["en", "hi"]);
export const sellerStatusEnum = pgEnum("seller_status", ["pending_kyc", "approved", "rejected", "suspended"]);
export const streamStatusEnum = pgEnum("stream_status", ["scheduled", "live", "ended"]);
export const orderStatusEnum = pgEnum("order_status", [
  "created",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
]);

export const users = pgTable("users", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  locale: localeEnum("locale").notNull().default("hi"),
  createdAt: createdAt(),
});

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

/** A verified brand. Only `approved` sellers can have products featured in streams. */
export const sellers = pgTable("sellers", {
  id: id(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  gstin: text("gstin"),
  pan: text("pan"),
  status: sellerStatusEnum("status").notNull().default("pending_kyc"),
  /** Razorpay Route linked account (acc_...) that receives the seller's share. */
  razorpayAccountId: text("razorpay_account_id"),
  createdAt: createdAt(),
});

export const creators = pgTable("creators", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  commissionBps: integer("commission_bps").notNull().default(1000),
  razorpayAccountId: text("razorpay_account_id"),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    sellerId: uuid("seller_id").notNull().references(() => sellers.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
    pricePaise: integer("price_paise").notNull(),
    mrpPaise: integer("mrp_paise"),
    gstBps: integer("gst_bps").notNull().default(500),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("products_seller_idx").on(t.sellerId), check("products_price_positive", sql`${t.pricePaise} > 0`)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sku: text("sku"),
    stock: integer("stock").notNull().default(0),
  },
  (t) => [
    uniqueIndex("product_variants_product_label_idx").on(t.productId, t.label),
    check("product_variants_stock_nonnegative", sql`${t.stock} >= 0`),
  ],
);

export const liveStreams = pgTable(
  "live_streams",
  {
    id: id(),
    creatorId: uuid("creator_id").notNull().references(() => creators.id),
    title: text("title").notNull(),
    status: streamStatusEnum("status").notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ivsChannelArn: text("ivs_channel_arn"),
    ivsPlaybackUrl: text("ivs_playback_url"),
    ivsChatRoomArn: text("ivs_chat_room_arn"),
    /** S3 prefix of the auto-recording, used for replays after the stream ends. */
    recordingS3Prefix: text("recording_s3_prefix"),
    createdAt: createdAt(),
  },
  (t) => [index("live_streams_creator_idx").on(t.creatorId), index("live_streams_status_idx").on(t.status)],
);

/** Products lined up for a stream before it starts. */
export const streamProducts = pgTable(
  "stream_products",
  {
    streamId: uuid("stream_id").notNull().references(() => liveStreams.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.streamId, t.productId] })],
);

/** Every pin event, so we can measure conversion per pinned product per stream. */
export const streamPins = pgTable(
  "stream_pins",
  {
    id: id(),
    streamId: uuid("stream_id").notNull().references(() => liveStreams.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
    unpinnedAt: timestamp("unpinned_at", { withTimezone: true }),
  },
  (t) => [index("stream_pins_stream_idx").on(t.streamId)],
);

/**
 * One order per seller: a Razorpay Route payment splits to a single seller account,
 * so a multi-seller cart is checked out as several orders.
 * The split columns are a snapshot of computeSplit() at payment time.
 */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    buyerUserId: uuid("buyer_user_id").notNull().references(() => users.id),
    sellerId: uuid("seller_id").notNull().references(() => sellers.id),
    creatorId: uuid("creator_id").references(() => creators.id),
    streamId: uuid("stream_id").references(() => liveStreams.id),
    status: orderStatusEnum("status").notNull().default("created"),
    totalPaise: integer("total_paise").notNull(),
    platformCommissionPaise: integer("platform_commission_paise").notNull(),
    creatorCommissionPaise: integer("creator_commission_paise").notNull(),
    tcsPaise: integer("tcs_paise").notNull(),
    sellerPayoutPaise: integer("seller_payout_paise").notNull(),
    /** Copied from addresses at checkout so later address edits don't change past orders. */
    shippingAddress: jsonb("shipping_address").notNull(),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    shiprocketShipmentId: text("shiprocket_shipment_id"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_buyer_idx").on(t.buyerUserId),
    index("orders_seller_idx").on(t.sellerId),
    index("orders_stream_idx").on(t.streamId),
    check(
      "orders_split_sums_to_total",
      sql`${t.platformCommissionPaise} + ${t.creatorCommissionPaise} + ${t.tcsPaise} + ${t.sellerPayoutPaise} = ${t.totalPaise}`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id),
    /** Snapshot of the title at purchase time. */
    title: text("title").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_quantity_positive", sql`${t.quantity} > 0`)],
);
