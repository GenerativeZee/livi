import type { Product } from "./domain";

/** Demo catalog for the Phase 0 spikes, so they run without a database. */
export const DEMO_PRODUCTS: Product[] = [
  {
    id: "p_bandhani_saree",
    sellerId: "s_jaipur_weaves",
    title: "Bandhani Georgette Saree — Rani Pink",
    description: "Hand-tied bandhani from Jaipur artisans. 5.5 m with blouse piece.",
    imageUrls: ["https://picsum.photos/seed/bandhani/600/800"],
    price: 189_900,
    mrp: 249_900,
    gstBps: 500,
    variants: [{ id: "v_free", label: "Free size", stock: 12 }],
  },
  {
    id: "p_block_kurta",
    sellerId: "s_sanganer_prints",
    title: "Sanganeri Block-Print Cotton Kurta",
    description: "Hand block-printed with natural dyes. Straight cut, calf length.",
    imageUrls: ["https://picsum.photos/seed/kurta/600/800"],
    price: 99_900,
    gstBps: 500,
    variants: [
      { id: "v_s", label: "S", stock: 5 },
      { id: "v_m", label: "M", stock: 8 },
      { id: "v_l", label: "L", stock: 0 },
    ],
  },
  {
    id: "p_mojari",
    sellerId: "s_jodhpur_leather",
    title: "Embroidered Leather Mojari",
    description: "Handstitched Jodhpuri mojari with zari embroidery.",
    imageUrls: ["https://picsum.photos/seed/mojari/600/800"],
    price: 149_900,
    gstBps: 1200,
    variants: [
      { id: "v_38", label: "38", stock: 3 },
      { id: "v_40", label: "40", stock: 6 },
    ],
  },
];

export const findDemoProduct = (id: string) => DEMO_PRODUCTS.find((p) => p.id === id);
