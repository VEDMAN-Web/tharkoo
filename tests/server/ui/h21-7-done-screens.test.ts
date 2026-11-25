import { describe, expect, it } from "vitest";
import { makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

const t = makeT();

describe("H21.7 done screens: words", () => {
  it("the live banner says what was bought and until when, or where the ad is", () => {
    expect(t("post.v2.done.liveTitle")).toBe("Your ad is live");
    expect(t("post.v2.done.boostOn", { name: "TOP", until: "Fri 27 Nov, 11:39 pm", credits: 45 })).toBe("TOP is on until Fri 27 Nov, 11:39 pm · 45 credits used");
    expect(t("post.v2.done.liveIn", { city: "Surat", category: "Spa & Salon" })).toBe("Your ad is live in Surat → Spa & Salon.");
  });

  it("the review banner says the boost was not charged", () => {
    expect(t("post.v2.done.reviewTitle")).toBe("Your ad is in review");
    expect(t("post.v2.done.reviewBoost", { name: "TOP" })).toContain("Your TOP was not charged: add it from My ads once the ad is live.");
    expect(t("post.v2.done.waitBoost", { name: "TOP" })).toBe("Boosts can only start on a live ad, so nothing was charged for TOP.");
  });

  it("the card, the boxes and the buttons have their words", () => {
    expect(t("post.v2.done.statusLive")).toBe("Live now");
    expect(t("post.v2.done.statusReview")).toBe("Waiting for review");
    expect(t("post.v2.done.open")).toBe("Open ad");
    expect(t("post.v2.done.preview")).toBe("Preview");
    expect(t("post.v2.done.myAds")).toBe("Go to My ads");
    expect(t("post.v2.done.moreTitle")).toBe("Want even more views?");
    expect(t("post.v2.done.upgrade", { name: "Super Top" })).toBe("Upgrade to Super Top");
    expect(t("post.v2.done.price", { count: 75 })).toBe("75 credits");
  });

  it("every done-screen text is a key under post.v2.done and none says buyer", () => {
    const keys = Object.keys(TEXT_DEFAULTS).filter((key) => key.startsWith("post.v2.done."));
    expect(keys.length).toBeGreaterThanOrEqual(30);
    for (const key of keys) expect((TEXT_DEFAULTS as Record<string, string>)[key].toLowerCase()).not.toContain("buyer");
  });
});
