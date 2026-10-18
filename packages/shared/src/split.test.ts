import { describe, expect, it } from "vitest";
import { computeSplit, DEFAULT_TERMS } from "./split";

describe("computeSplit", () => {
  it("splits a ₹2,000 order (PRD's assumed AOV) with default terms", () => {
    const split = computeSplit(200_000);
    expect(split).toEqual({
      total: 200_000,
      taxableValue: 190_476,
      platformCommission: 20_000,
      creatorCommission: 20_000,
      tcs: 1_905,
      seller: 158_095,
    });
  });

  it("always sums back to the total, including odd amounts", () => {
    for (const total of [1, 99, 12_345, 99_999, 1_234_567]) {
      const s = computeSplit(total);
      expect(s.platformCommission + s.creatorCommission + s.tcs + s.seller).toBe(total);
    }
  });

  it("supports orders with no creator (direct shop purchase)", () => {
    const s = computeSplit(100_000, { ...DEFAULT_TERMS, creatorBps: 0 });
    expect(s.creatorCommission).toBe(0);
    expect(s.seller).toBe(100_000 - 10_000 - 952);
  });

  it("rejects non-integer or non-positive amounts", () => {
    expect(() => computeSplit(0)).toThrow();
    expect(() => computeSplit(10.5)).toThrow();
  });

  it("rejects terms that exceed the sale", () => {
    expect(() => computeSplit(100, { ...DEFAULT_TERMS, platformBps: 9_000, creatorBps: 2_000 })).toThrow();
  });
});
