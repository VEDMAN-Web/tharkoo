import { describe, expect, it } from "vitest";
import { adCreditsNeeded, adCreditsShort, START_PLAN_CODES } from "@/components/post/BoostChoice";
import { makeT } from "@/lib/ui/text";

describe("H19.6b ad credits for the last step", () => {
  it("adds the posting fee and the plan price", () => {
    expect(adCreditsNeeded({ fee: 30, plan: { amount: 80 } })).toBe(110);
    expect(adCreditsNeeded({ fee: 0, plan: { amount: 80 } })).toBe(80);
    expect(adCreditsNeeded({ fee: 30, plan: null })).toBe(30);
    expect(adCreditsNeeded({ fee: 0, plan: null })).toBe(0);
  });

  it("never counts a negative fee or price", () => {
    expect(adCreditsNeeded({ fee: -5, plan: { amount: -9 } })).toBe(0);
  });

  it("says how many credits are missing, and none when the balance covers it", () => {
    expect(adCreditsShort(110, 100)).toBe(10);
    expect(adCreditsShort(110, 110)).toBe(0);
    expect(adCreditsShort(110, 500)).toBe(0);
    expect(adCreditsShort(0, 0)).toBe(0);
    expect(adCreditsShort(80, 0)).toBe(80);
  });

  it("leaves the server to decide when the balance is not known", () => {
    expect(adCreditsShort(110, null)).toBe(0);
  });

  it("offers TOP and Super Top as the boosts on the last step", () => {
    expect([...START_PLAN_CODES]).toEqual(["top", "super-top"]);
  });
});

describe("H19.6b wording", () => {
  const t = makeT();
  it("has the lines the choice, the tooltips and the notes use", () => {
    expect(t("post.boost.price", { count: 80 })).toBe("+80 ad credits");
    expect(t("post.boost.costs", { count: 80 })).toContain("80 ad credits");
    expect(t("post.boost.short", { count: 10 })).toContain("10 more ad credits");
    expect(t("post.boost.started", { name: "TOP", paid: "80 credits" })).toBe("TOP started (80 credits).");
    expect(t("post.success.myAds")).toBe("My ads");
  });

  it("never says the word buyer", () => {
    for (const key of ["post.boost.title", "post.boost.freeTip", "post.boost.costs", "post.boost.failed", "post.boost.later", "promote.tip"] as const) {
      expect(t(key, { count: 1, reason: "x", name: "x", paid: "x" }).toLowerCase()).not.toContain("buyer");
    }
  });
});

describe("H19.6b interests on the public ad", () => {
  it("shows up to five short interests and nothing else", async () => {
    const { interestsOf } = await import("@/lib/ad-details");
    expect(interestsOf({ interests: ["Music", " Travel ", "music", "Cooking", "Cricket", "Films", "Chess"] })).toEqual(["Music", "Travel", "Cooking", "Cricket", "Films"]);
    expect(interestsOf({ interests: ["x".repeat(31), 7, null, "", "  "] })).toEqual([]);
    expect(interestsOf({ interests: "Music" })).toEqual([]);
    expect(interestsOf(undefined)).toEqual([]);
    expect(interestsOf({})).toEqual([]);
  });
});

describe("H19.6b the old 20-character rule is gone", () => {
  it("a short or empty description raises no error on the form check", async () => {
    const { validatePost } = await import("@/lib/ui/post-form");
    const base = { categoryId: "c", cityId: "x", nickname: "Asha", title: "A good title", phone: "9876543210", contactMode: "phone", age: "", terms: true, adult: true, attrs: {}, fields: [], text: "" };
    expect(validatePost(base).text).toBeUndefined();
    expect(validatePost({ ...base, text: "Hi" }).text).toBeUndefined();
  });
});
