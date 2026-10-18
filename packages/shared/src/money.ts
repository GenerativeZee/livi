/** All money is stored and passed around as integer paise (₹1 = 100 paise). */
export type Paise = number;

/** Basis points: 10000 bps = 100%. */
export type Bps = number;

export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);

export const percentOf = (amount: Paise, bps: Bps): Paise => Math.round((amount * bps) / 10_000);

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export const formatINR = (amount: Paise): string => inr.format(amount / 100);
