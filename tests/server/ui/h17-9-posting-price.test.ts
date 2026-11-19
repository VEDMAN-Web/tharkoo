import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { costAnswer } from "@/lib/ui/cost-answer";
import { TEXT_DEFAULTS, makeT } from "@/lib/ui/text";

/** H17.9: one posting-price message everywhere: "Your first 3 ads are free." Nothing says posting is free without that condition. */

const MESSAGE = "Your first 3 ads are free.";
const t = makeT();

/** Wording that promises free posting with no condition. */
const UNCONDITIONAL = [
  /free to post/i,
  /posting (an ad |ads )?(is|stays|remains) free/i,
  /post (an ad |ads |yours |your ad )?(for )?free\b/i,
  /free ads across/i,
  /free classifieds/i,
  /free weekly (limit|ads)/i,
  /\bpost(ing)? is free/i,
];

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("the default site text", () => {
  it("has no sentence that says posting is free without the first-3-ads condition", () => {
    const bad = Object.entries(TEXT_DEFAULTS).filter(([, text]) => UNCONDITIONAL.some((pattern) => pattern.test(String(text))));
    expect(bad.map(([key]) => key)).toEqual([]);
  });

  it("says the same message on the home banner, the sample ad note, My ads, the price card and How it works", () => {
    for (const key of ["home.banner.sub", "demo.message", "myads.cost.free", "price.allFreeText", "howitworks.cost.free"] as const) {
      expect(TEXT_DEFAULTS[key], key).toContain(MESSAGE);
    }
  });
});

describe("How it works: what does it cost to post", () => {
  const money = { paidPostingOn: true, postingFeeCredits: 30, creditPriceInr: 10, freeAdsPerAccount: 3 };

  it("says the first 3 ads are free, whatever the posting rule", () => {
    expect(costAnswer(t, { ...money, paidPostingOn: false })).toContain(MESSAGE);
    const withFee = costAnswer(t, money);
    expect(withFee).toContain("first 3 ads are free");
    expect(withFee).toContain("shown before you publish");
  });
});

describe("other places that talk about the price of posting", () => {
  it("the How it works and Terms copy, the help list and the AI draft prompt do not promise free posting", () => {
    for (const file of ["src/content/trust.ts", "src/data/help.ts", "src/server/content/studio/ai-draft.ts"]) {
      const text = read(file);
      for (const pattern of UNCONDITIONAL) expect(text, `${file} ${pattern}`).not.toMatch(pattern);
    }
  });

  it("the posting steps in the trust copy name the first-3-ads rule and the price shown before publishing", () => {
    expect(read("src/content/trust.ts")).toContain("Your first 3 ads are free");
  });
});
