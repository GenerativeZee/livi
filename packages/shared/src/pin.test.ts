import { describe, expect, it } from "vitest";
import { decodeCue, encodeCue } from "./pin";

describe("stream cues", () => {
  it("round-trips pin and unpin cues", () => {
    const pin = { t: "pin", productId: "p_mojari", sentAt: 1_760_000_000_000 } as const;
    expect(decodeCue(encodeCue(pin))).toEqual(pin);
    expect(decodeCue(encodeCue({ t: "unpin", sentAt: 1 }))).toEqual({ t: "unpin", sentAt: 1 });
  });

  it("ignores metadata that isn't ours instead of throwing", () => {
    expect(decodeCue("not json")).toBeNull();
    expect(decodeCue('{"t":"poll"}')).toBeNull();
    expect(decodeCue('{"t":"pin"}')).toBeNull();
  });

  it("refuses product ids long enough to bloat the payload", () => {
    expect(() => encodeCue({ t: "pin", productId: "x".repeat(65), sentAt: 1 })).toThrow();
  });
});
