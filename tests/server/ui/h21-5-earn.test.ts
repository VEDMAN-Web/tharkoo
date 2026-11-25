import { describe, expect, it } from "vitest";
import { earnShares } from "@/components/post/EarnPanel";
import { makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

describe("H21.5a earnings panel shares", () => {
  const t = makeT({});
  it("the setting is Tharkoo's share: 30 means the seller keeps 70", () => {
    const shares = earnShares(30);
    expect(shares).toEqual({ keep: 70, rest: 30 });
    const text = t("post.v2.rev.earnKeepPercent", shares);
    expect(text).toContain("You keep 70%");
    expect(text).toContain("Tharkoo keeps 30%");
  });

  it("stays between 0 and 100", () => {
    expect(earnShares(0)).toEqual({ keep: 100, rest: 0 });
    expect(earnShares(140)).toEqual({ keep: 0, rest: 100 });
    expect(earnShares(-5)).toEqual({ keep: 100, rest: 0 });
  });

  it("the per-call line keeps Vedant's shape with the seller's part first", () => {
    expect(TEXT_DEFAULTS["post.v2.rev.earnKeep"]).toMatch(/^You keep \{keep\}.*Tharkoo keeps \{rest\}/);
    expect(t("post.v2.rev.earnKeep", { keep: 7, rupees: 70, rest: 3, restRupees: 30 })).toContain("You keep 7 (₹70). Tharkoo keeps 3.");
  });
});
