import type { Page } from "@playwright/test";
import { expect, isPhone, setSellerAvailable, slugFromAdPath, test } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.5: Online now / Away on the listing card and the ad page, and the call button following it. Both widths. */

async function expectChatWorks(page: Page) {
  const chat = page.locator("[data-tk=chat]:visible").first();
  await expect(chat).toBeEnabled();
}

test.describe("H7.5 Online now and Away on cards and the ad page", () => {
  test("the ad page follows the seller's switch and pauses the call while Away", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "avail");
    const slug = slugFromAdPath(ad.adHref);

    await setSellerAvailable(slug, false);
    await page.goto(`/ad/${slug}/`);
    await expect(page.locator("[data-tk=availability]").first()).toHaveAttribute("data-status", "away");
    if (!isPhone(page)) {
      await expect(page.locator("[data-tk=contact-card] [data-tk=call]")).toBeDisabled();
      await expect(page.locator("[data-tk=contact-card] [data-tk=calls-paused]")).toBeVisible();
    }
    await expectChatWorks(page);

    await setSellerAvailable(slug, true);
    await page.goto(`/ad/${slug}/`);
    await expect(page.locator("[data-tk=availability]").first()).toHaveAttribute("data-status", "online");
    if (!isPhone(page)) {
      await expect(page.locator("[data-tk=contact-card] [data-tk=call]")).toBeEnabled();
      await expect(page.locator("[data-tk=contact-card] [data-tk=calls-paused]")).toHaveCount(0);
    }
    await expectChatWorks(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("the listing card shows the same status as the ad page", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "cardavail");
    const slug = slugFromAdPath(ad.adHref);
    await setSellerAvailable(slug, true);

    await page.goto(`/search/?q=${encodeURIComponent(ad.title)}`);
    const card = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-tk=availability]")).toHaveAttribute("data-status", "online");

    await setSellerAvailable(slug, false);
    await page.goto(`/search/?q=${encodeURIComponent(ad.title)}`);
    await expect(page.locator("[data-tk=card]").filter({ hasText: ad.title }).first().locator("[data-tk=availability]")).toHaveAttribute("data-status", "away");
  });
});
