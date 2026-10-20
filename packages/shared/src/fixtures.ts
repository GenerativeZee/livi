import type { Product } from "./domain";

// Demo data used to seed development databases. IDs are fixed so seeded databases,
// tests and the creator app all agree on them.

const demoId = (n: number) => `d0000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const DEMO_SHOPPER = {
  id: demoId(1),
  phone: "+919800000001",
  name: "Ananya (demo shopper)",
  address: {
    name: "Ananya Sharma",
    phone: "+919800000001",
    line1: "B-42, Lajpat Nagar II",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110024",
  },
};

export const DEMO_CREATOR = {
  id: demoId(11),
  userId: demoId(2),
  phone: "+919800000002",
  handle: "priya.styles",
  displayName: "Priya Styles",
  commissionBps: 1000,
};

export const DEMO_SELLERS = [
  { id: demoId(101), userId: demoId(3), phone: "+919800000003", businessName: "Jaipur Weaves" },
  { id: demoId(102), userId: demoId(4), phone: "+919800000004", businessName: "Sanganer Prints" },
  { id: demoId(103), userId: demoId(5), phone: "+919800000005", businessName: "Jodhpur Leather Co." },
] as const;

export const DEMO_PRODUCTS: Product[] = [
  {
    id: demoId(201),
    sellerId: DEMO_SELLERS[0].id,
    title: "Bandhani Georgette Saree — Rani Pink",
    description: "Hand-tied bandhani from Jaipur artisans. 5.5 m with blouse piece.",
    imageUrls: ["https://picsum.photos/seed/bandhani/600/800"],
    price: 189_900,
    mrp: 249_900,
    gstBps: 500,
    variants: [{ id: demoId(301), label: "Free size", stock: 12 }],
  },
  {
    id: demoId(202),
    sellerId: DEMO_SELLERS[1].id,
    title: "Sanganeri Block-Print Cotton Kurta",
    description: "Hand block-printed with natural dyes. Straight cut, calf length.",
    imageUrls: ["https://picsum.photos/seed/kurta/600/800"],
    price: 99_900,
    gstBps: 500,
    variants: [
      { id: demoId(302), label: "S", stock: 5 },
      { id: demoId(303), label: "M", stock: 8 },
      { id: demoId(304), label: "L", stock: 0 },
    ],
  },
  {
    id: demoId(203),
    sellerId: DEMO_SELLERS[2].id,
    title: "Embroidered Leather Mojari",
    description: "Handstitched Jodhpuri mojari with zari embroidery.",
    imageUrls: ["https://picsum.photos/seed/mojari/600/800"],
    price: 149_900,
    gstBps: 1200,
    variants: [
      { id: demoId(305), label: "38", stock: 3 },
      { id: demoId(306), label: "40", stock: 6 },
    ],
  },
];

export const DEMO_STREAM = {
  id: demoId(401),
  creatorId: DEMO_CREATOR.id,
  title: "Festive drops: bandhani, block prints & mojaris",
  productIds: DEMO_PRODUCTS.map((p) => p.id),
};
