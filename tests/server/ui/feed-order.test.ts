import { describe, expect, it } from "vitest";
import { hourSeed, orderFeed } from "@/components/feedOrder";

const ads = [
  { id: 1, variant: "free" },
  { id: 2, variant: "top" },
  { id: 3, variant: "free" },
  { id: 4, variant: "supertop" },
  { id: 5, variant: "free" },
  { id: 6, variant: "free" },
];

describe("orderFeed", () => {
  it("puts paid tiers first in their original order", () => {
    const out = orderFeed(ads, 7);
    expect(out.slice(0, 2).map((a) => a.id)).toEqual([2, 4]);
    expect(out).toHaveLength(ads.length);
  });
  it("is stable for the same seed and keeps every ad", () => {
    expect(orderFeed(ads, 11)).toEqual(orderFeed(ads, 11));
    expect(orderFeed(ads, 11).map((a) => a.id).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("hourSeed changes only on the hour", () => {
    expect(hourSeed(3_600_000 * 5 + 10)).toBe(hourSeed(3_600_000 * 5 + 3_599_000));
    expect(hourSeed(3_600_000 * 6)).toBe(hourSeed(3_600_000 * 5) + 1);
  });
});
