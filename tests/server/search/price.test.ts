import { describe, expect, it } from "vitest";
import { formatPrice } from "@/components/search/price";
import { cleanPrice } from "@/server/search/query";

describe("price display", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatPrice(1250000)).toBe("₹ 12,50,000");
    expect(formatPrice(999)).toBe("₹ 999");
  });

  it("shows nothing for a missing or unusable price", () => {
    for (const value of [undefined, null, 0, -5, Number.NaN, "100"]) expect(formatPrice(value)).toBe("");
    for (const value of [undefined, null, 0, -5, Number.NaN, "100"]) expect(cleanPrice(value)).toBeNull();
    expect(cleanPrice(500)).toBe(500);
  });
});
