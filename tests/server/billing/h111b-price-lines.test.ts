import { describe, expect, it } from "vitest";
import { afterFreeTitle, enoughFor, enoughParts, freeAdsTitle, priceOneLine, type PriceListData } from "@/lib/price-list";

const base: PriceListData = {
  creditPriceInr: 10,
  paidPostingOn: true,
  adFee: 20,
  freeAds: 3,
  freeLeft: 2,
  top: { name: "TOP", credits: 45, hours: 72 },
  superTop: { name: "Super Top", credits: 75, hours: 72 },
};

describe("H11.1b the words of the price card", () => {
  it("names the free ads and the paid row from the live number", () => {
    expect(freeAdsTitle(3)).toBe("Ads 1, 2 and 3");
    expect(freeAdsTitle(1)).toBe("Ad 1");
    expect(freeAdsTitle(2)).toBe("Ads 1 and 2");
    expect(freeAdsTitle(7)).toBe("Ads 1 to 7");
    expect(freeAdsTitle(0)).toBe("");
    expect(afterFreeTitle(3)).toBe("Ad 4 and every ad after");
    expect(afterFreeTitle(0)).toBe("Every ad");
  });

  it("one line: free ads left, then the rupee price; a visitor sees the first free ads; nothing while posting is free", () => {
    expect(priceOneLine(base)).toBe("2 free ads left, then ₹200 per ad");
    expect(priceOneLine({ ...base, freeLeft: 1 })).toBe("1 free ad left, then ₹200 per ad");
    expect(priceOneLine({ ...base, freeLeft: 0 })).toBe("Each new ad costs ₹200 (20 credits)");
    expect(priceOneLine({ ...base, freeLeft: null })).toBe("3 free ads, then ₹200 per ad");
    expect(priceOneLine({ ...base, paidPostingOn: false })).toBeNull();
    expect(priceOneLine({ ...base, adFee: 0 })).toBeNull();
    expect(priceOneLine({ ...base, creditPriceInr: 12 })).toBe("2 free ads left, then ₹240 per ad");
  });

  it("the pack line names only the parts that exist, rounded down, in the order ads, TOP, Super Top", () => {
    const words = (list: PriceListData, total: number) => enoughParts(enoughFor(total, list), list).map((part) => part.text);
    expect(words(base, 210)).toEqual(["10 ads", "4 TOP", "2 Super Top"]);
    expect(words({ ...base, superTop: null }, 210)).toEqual(["10 ads", "4 TOP"]);
    expect(words({ ...base, top: null, superTop: null }, 210)).toEqual(["10 ads"]);
    expect(words({ ...base, paidPostingOn: false }, 210)).toEqual(["4 TOP", "2 Super Top"]);
    expect(words(base, 10)).toEqual([]);
    expect(words(base, 50)).toEqual(["2 ads", "1 TOP"]);
    expect(enoughParts(enoughFor(210, base), base)[0]).toEqual({ text: "10 ads", strong: true });
  });
});
