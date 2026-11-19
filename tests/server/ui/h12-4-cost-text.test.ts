import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayCard } from "@/components/post/PayParts";
import { costAnswer } from "@/lib/ui/cost-answer";
import { makeT } from "@/lib/ui/text";

const t = makeT();

describe("H12.4 (d): the step 5 card title", () => {
  it("reads Publish when the ad is one of the account's free ads", () => {
    const html = renderToStaticMarkup(createElement(PayCard, { fee: 30, price: 10, balance: 0, short: 0, onRecharge: () => undefined, freeAd: { adNumber: 1, freeAds: 3 } }));
    expect(html).toContain('<h2 class="tkp-pay-title">Publish</h2>');
    expect(html).not.toContain("Pay and publish");
  });

  it("still reads Pay and publish when the ad costs credits", () => {
    const html = renderToStaticMarkup(createElement(PayCard, { fee: 30, price: 10, balance: 100, short: 0, onRecharge: () => undefined }));
    expect(html).toContain("Pay and publish");
  });
});

describe("H12.4 (e): How it works, what does it cost to post", () => {
  const money = { paidPostingOn: true, postingFeeCredits: 30, creditPriceInr: 10, freeAdsPerAccount: 3 };

  it("says the first 3 ads are free when paid posting is off (H17.9 one message)", () => {
    expect(costAnswer(t, { ...money, paidPostingOn: false })).toMatch(/^Your first 3 ads are free\./);
  });

  it("says the first ads are free, then the fee in credits and rupees, read from the settings", () => {
    const text = costAnswer(t, money);
    expect(text).toContain("Your first 3 ads are free");
    expect(text).toContain("30 credits (₹300)");
    expect(costAnswer(t, { ...money, freeAdsPerAccount: 5, postingFeeCredits: 20, creditPriceInr: 12 })).toContain("Your first 5 ads are free. After that each ad costs 20 credits (₹240)");
  });

  it("says only the fee when no ads are free", () => {
    const text = costAnswer(t, { ...money, freeAdsPerAccount: 0 });
    expect(text).toMatch(/^Each ad costs 30 credits \(₹300\)/);
    expect(text).not.toContain("free ads");
  });

  it("never says posting costs credits in general terms any more", () => {
    for (const set of [money, { ...money, paidPostingOn: false }, { ...money, freeAdsPerAccount: 0 }]) expect(costAnswer(t, set)).not.toContain("Posting an ad costs credits");
  });

  it("uses the admin's own wording when a site text is edited", () => {
    const own = makeT({ "howitworks.cost.free": "No charge for now." });
    expect(costAnswer(own, { ...money, paidPostingOn: false })).toBe("No charge for now.");
  });
});
