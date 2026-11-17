import { describe, expect, it } from "vitest";
import { sellerLine } from "@/components/buyer/SellerHomeAds";

const none = { live: 0, review: 0, draft: 0, endingSoon: 0 };

describe("H9.2 the one next step on an advertiser's account home", () => {
  it("says Renew while an ad is about to end, otherwise Post an ad", () => {
    expect(sellerLine({ ...none, live: 3, endingSoon: 1 }, 40)).toMatchObject({ action: "Renew", href: "/u/account/ads/", lead: "1 ad ends soon. Renew to keep it showing." });
    expect(sellerLine({ ...none, live: 3, endingSoon: 2 }, 40).lead).toBe("2 ads end soon. Renew to keep them showing.");
    expect(sellerLine({ ...none, live: 2 }, 1)).toMatchObject({ action: "Post an ad", href: "/u/post-insert/", lead: "2 live now · 1 view in total" });
    expect(sellerLine(none, 0)).toMatchObject({ action: "Post an ad", lead: "You have no ads yet." });
  });

  it("has no buyer headline for anyone", () => {
    for (const counts of [none, { ...none, live: 1 }, { ...none, review: 1 }, { ...none, draft: 1 }]) {
      expect(sellerLine(counts, 0).lead).not.toMatch(/Find it, save it/);
    }
  });
});
