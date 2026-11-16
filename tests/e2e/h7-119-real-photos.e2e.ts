import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

const SHOTS = process.env.REAL_PHOTOS_SHOTS_DIR || "";
const SIZES = [
  [1536, 674],
  [390, 844],
] as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const original = page.viewportSize();
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png` });
  }
  if (original) await page.setViewportSize(original);
}

async function makePeopleAd(listingId: string, change: Record<string, unknown>) {
  await withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({ slug: "dating" });
    await db.collection("listings").updateOne({ _id: new ObjectId(listingId) }, { $set: { categoryId: category!._id, ...change } });
  });
}

async function imageSources(page: Page, scope: string) {
  return page.locator(`${scope} img`).evaluateAll((images) =>
    images.map((image) => {
      const src = (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src;
      const wrapped = new URL(src, location.href).searchParams.get("url");
      return decodeURIComponent(wrapped || src);
    }),
  );
}

test.describe("H7.119 a real ad shows its own photo or none, never stock faces", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("a real people ad with no photo shows a plain box on its page, its card and My ads, and no badges", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "nophoto");
    await makePeopleAd(ad.listingId, { mediaIds: [], coverMediaId: null });

    await page.goto("/u/account/ads/");
    const mine = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(mine).toBeVisible();
    expect((await imageSources(page, "[data-tk=card]")).filter((src) => src.includes("/placeholders/profiles/"))).toEqual([]);
    await expect(mine).not.toContainText(/ID verified|Age verified|Photo verified/);
    await shot(page, "my-ads-no-photo");

    await page.goto(ad.adHref);
    await expect(page.locator("[data-tk=gallery]")).toHaveCount(0);
    await expect(page.locator(".tkn-gal-empty")).toBeVisible();
    await expect(page.locator(".tkn-gal-img")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "ad-page-no-photo");

    await page.goto("/dating/mumbai/");
    const listed = page.locator("article, li").filter({ hasText: ad.title }).first();
    await expect(listed).toBeVisible();
    const around = await listed.locator("img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
    expect(around.filter((src) => src.includes("placeholders") && src.includes("profiles"))).toEqual([]);
    await shot(page, "listing-no-photo");
  });

  test("a real ad shows the photo its owner uploaded, on its page and in My ads", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "ownphoto");
    await makePeopleAd(ad.listingId, {});

    await page.goto("/u/account/ads/");
    const mine = page.locator("[data-tk=card]").filter({ hasText: ad.title }).first();
    await expect(mine).toBeVisible();
    const cardSources = await mine.locator("img").evaluateAll((images) => images.map((image) => decodeURIComponent((image as HTMLImageElement).src)));
    expect(cardSources.some((src) => src.includes("/uploads/"))).toBe(true);
    expect(cardSources.filter((src) => src.includes("/placeholders/profiles/"))).toEqual([]);
    await shot(page, "my-ads-own-photo");

    await page.goto(ad.adHref);
    await expect(page.locator("[data-tk=gallery]")).toBeVisible();
    const sources = await imageSources(page, "[data-tk=gallery]");
    expect(sources.some((src) => src.includes("/uploads/"))).toBe(true);
    expect(sources.filter((src) => src.includes("/placeholders/profiles/"))).toEqual([]);
    await expect(page.locator("[data-tk=gallery-counter]")).toHaveCount(0);
    await shot(page, "ad-page-own-photo");
  });

  test("an ad that takes email only shows no Call or WhatsApp, only chat", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "emailonly");
    await makePeopleAd(ad.listingId, { contact: { acceptForm: true } });

    await page.goto(ad.adHref);
    await expect(page.locator("[data-tk=chat]").first()).toBeVisible();
    await expect(page.locator("[data-tk=call]")).toHaveCount(0);
    await expect(page.locator("[data-tk=whatsapp]")).toHaveCount(0);
    await shot(page, "ad-page-email-only");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("[data-tk=chat]:visible").first()).toBeVisible();
    await expect(page.locator("[data-tk=call]")).toHaveCount(0);
    await expect(page.locator("[data-tk=whatsapp]")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("an ad with a phone and WhatsApp keeps both buttons", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "bothways");
    await makePeopleAd(ad.listingId, { contact: { phone: "+919876543210", whatsapp: "+919876543210", acceptForm: true } });
    await page.goto(ad.adHref);
    await expect(page.locator("[data-tk=call]").first()).toBeVisible();
    await expect(page.locator("[data-tk=whatsapp]").first()).toBeVisible();
  });
});
