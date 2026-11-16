import { expect, originHeaders, test, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.121: a live ad stays live and indexed while its owner edits it. */

async function readAd(page: import("@playwright/test").Page, id: string) {
  const res = await page.request.get(`/api/listings/by-id/${id}`);
  expect(res.status()).toBe(200);
  return (await res.json()).data as { slug: string; title: string; status: string; seoNoindex: boolean };
}

test.describe("H7.121 a live ad stays live while it is edited", () => {
  test("change the title on step 2 and leave: the ad is still live, indexed, and shows the new title", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "stayslive");
    const before = await readAd(page, ad.listingId);
    const edited = `${ad.title} new title`;
    await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=2`);
    await page.locator("#title").fill(edited);
    await page.locator("[data-tk=go-on]").click();
    await expect(page.locator("[data-tk=step-of]")).toContainText("Step 3 of");
    // Leave the editor here, without saving at the end.
    await page.goto("/u/account/ads/");
    const card = page.locator("[data-tk=card]").filter({ hasText: edited }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Live");
    await expect(card).not.toContainText("In review");
    const after = await readAd(page, ad.listingId);
    expect(after.status).toBe("active");
    expect(after.seoNoindex).toBe(false);
    expect(after.slug).toBe(before.slug);
    expect(after.title).toBe(edited);
    await expect
      .poll(async () => (await (await page.request.get(ad.adHref)).text()).includes(edited), { timeout: 60_000, intervals: [3_000] })
      .toBe(true);
  });

  test("a forbidden word in an edit is refused with a message, and the ad stays unchanged and live", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const ad = await createLiveAd(page, baseURL!, "stayslive2");
    await withLocalDb((db) => db.collection("banned_words").insertOne({ text: "zzzlivebanned", matchType: "contains", createdAt: new Date() }));
    try {
      await page.goto(`/u/post-insert/?draft=${ad.listingId}&step=2`);
      await page.locator("#title").fill(`${ad.title} zzzlivebanned`);
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of");
      await expect(page.locator(".tkp-banner")).toContainText(/not allowed/i);
      const after = await readAd(page, ad.listingId);
      expect(after.title).toBe(ad.title);
      expect(after.status).toBe("active");
      const refused = await page.request.patch(`/api/listings/${ad.listingId}`, {
        headers: originHeaders(baseURL!, "/u/post-insert/"),
        data: { stage: "basics", title: `${ad.title} zzzlivebanned` },
      });
      expect(refused.status()).toBeGreaterThanOrEqual(400);
      expect((await readAd(page, ad.listingId)).status).toBe("active");
    } finally {
      await withLocalDb((db) => db.collection("banned_words").deleteMany({ text: "zzzlivebanned" }));
    }
  });
});
