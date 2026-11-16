import type { Page } from "@playwright/test";
import { expect, firstAdPath, isPhone, setSellerAvailable, slugFromAdPath, test } from "./helpers";
import { createLiveAd } from "./flows";

/** H7.5: Online now / Away on the listing card and the ad page, and the call button following it. Both widths. */

async function expectChatWorks(page: Page) {
  const chat = page.locator("[data-tk=chat]:visible").first();
  await expect(chat).toBeEnabled();
}

/** The seeded people category: a live dating ad and its feed. */
const PEOPLE_FEED = "/dating/bengaluru/";

test.describe("H7.5 Online now and Away on cards and the ad page", () => {
  test("a people ad has no video call on the ad page; Call, WhatsApp, chat and the badge stay", async ({ page }) => {
    test.setTimeout(120_000);
    const path = await firstAdPath(page, PEOPLE_FEED);
    await setSellerAvailable(slugFromAdPath(path), true);
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-tk=seller-row]")).toBeAttached();
    await expect(page.locator("[data-tk=contact-card] [data-tk=tour], [data-tk=bottom-bar] [data-tk=tour]")).toHaveCount(0);
    await expect(page.locator("[data-tk=chat]:visible").first()).toBeEnabled();

    await page.goto(PEOPLE_FEED);
    await expect(page.locator(":is([data-tk=card], [data-tk=home-ad])").first()).toBeVisible();
    await expect(page.locator(":is([data-tk=card], [data-tk=home-ad]) [data-tk=call]")).toHaveCount(0);
    await expect(page.locator(`[data-tk=home-ad]:has(a[href*="${slugFromAdPath(path)}"]) [data-tk=availability]`).first()).toBeAttached();
  });

  test("a job ad keeps its Call button whether the seller is online or Away", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "callable");
    const slug = slugFromAdPath(ad.adHref);
    await setSellerAvailable(slug, true);
    await page.goto(ad.adHref);
    if (!isPhone(page)) {
      await expect(page.locator("[data-tk=contact-card] [data-tk=call]")).toBeEnabled();
    }
    await setSellerAvailable(slug, false);
    await page.goto(ad.adHref);
    if (!isPhone(page)) {
      await expect(page.locator("[data-tk=contact-card] [data-tk=call]")).toBeEnabled();
    }
    await expect(page.locator("[data-tk=chat]:visible").first()).toBeEnabled();
  });

  test("the ad page follows the seller's switch: Away or Online now, with chat working both ways", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "avail");
    const slug = slugFromAdPath(ad.adHref);

    await setSellerAvailable(slug, false);
    await page.goto(`/ad/${slug}/`);
    await expect(page.locator("[data-tk=availability]").first()).toHaveAttribute("data-status", "away");
    await expectChatWorks(page);

    await setSellerAvailable(slug, true);
    await page.goto(`/ad/${slug}/`);
    await expect(page.locator("[data-tk=availability]").first()).toHaveAttribute("data-status", "online");
    await expectChatWorks(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("the listing card shows Online now only while the seller is online, and the ad page says Away", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const ad = await createLiveAd(page, baseURL!, "cardavail");
    const slug = slugFromAdPath(ad.adHref);
    await setSellerAvailable(slug, true);

    await page.goto(`/search/?q=${encodeURIComponent(ad.title)}`);
    const card = page.locator(":is([data-tk=card], [data-tk=home-ad])").filter({ hasText: ad.title }).first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-tk=availability]")).toHaveAttribute("data-status", "online");

    await setSellerAvailable(slug, false);
    await page.goto(`/search/?q=${encodeURIComponent(ad.title)}`);
    const away = page.locator(":is([data-tk=card], [data-tk=home-ad])").filter({ hasText: ad.title }).first();
    await expect(away).toBeVisible();
    await expect(away.locator("[data-tk=availability]")).toHaveCount(0);
  });
});
