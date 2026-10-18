import { percentOf, type Bps, type Paise } from "./money";

/**
 * Commercial terms for one sale. Defaults follow the PRD:
 * 10% platform take on the GST-inclusive price, 10% creator revenue share,
 * and 1% GST TCS on the taxable (pre-GST) value.
 *
 * Assumption: the creator's share comes out of the seller's proceeds (affiliate model),
 * so the platform's 10% take is never diluted.
 */
export interface SplitTerms {
  platformBps: Bps;
  creatorBps: Bps;
  /** GST rate on the item; apparel is typically 500 (5%) or 1200 (12%). */
  gstBps: Bps;
  tcsBps: Bps;
}

export const DEFAULT_TERMS: SplitTerms = {
  platformBps: 1000,
  creatorBps: 1000,
  gstBps: 500,
  tcsBps: 100,
};

export interface Split {
  total: Paise;
  taxableValue: Paise;
  platformCommission: Paise;
  creatorCommission: Paise;
  /** Withheld by the platform and remitted to the government; seller claims credit. */
  tcs: Paise;
  /** Remainder after all deductions, so the parts always add up to `total`. */
  seller: Paise;
}

export function computeSplit(total: Paise, terms: SplitTerms = DEFAULT_TERMS): Split {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`total must be a positive integer in paise, got ${total}`);
  }
  const taxableValue = Math.round((total * 10_000) / (10_000 + terms.gstBps));
  const platformCommission = percentOf(total, terms.platformBps);
  const creatorCommission = percentOf(total, terms.creatorBps);
  const tcs = percentOf(taxableValue, terms.tcsBps);
  const seller = total - platformCommission - creatorCommission - tcs;
  if (seller < 0) {
    throw new Error("terms deduct more than the sale amount");
  }
  return { total, taxableValue, platformCommission, creatorCommission, tcs, seller };
}
