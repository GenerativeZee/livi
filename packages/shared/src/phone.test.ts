import { describe, expect, it } from "vitest";
import { formatIndianPhone, normalizeIndianPhone } from "./phone";

describe("normalizeIndianPhone", () => {
  it.each(["9876543210", "98765 43210", "+91 98765-43210", "919876543210", "09876543210", "+919876543210"])(
    "accepts %s",
    (input) => expect(normalizeIndianPhone(input)).toBe("+919876543210"),
  );

  it.each(["", "12345", "5876543210", "98765432101", "+1 4155550123", "98765abcde"])("rejects %s", (input) =>
    expect(normalizeIndianPhone(input)).toBeNull(),
  );
});

describe("formatIndianPhone", () => {
  it("groups the digits for display", () => expect(formatIndianPhone("+919876543210")).toBe("+91 98765 43210"));
});
