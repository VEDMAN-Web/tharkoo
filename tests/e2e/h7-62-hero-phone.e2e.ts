import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

const STACKED = [
  { width: 390, height: 844, photo: 420 },
  { width: 600, height: 900, photo: 460 },
  { width: 768, height: 1024, photo: 460 },
  { width: 1023, height: 900, photo: 460 },
];

async function boxes(page: Page) {
  const photo = await page.locator(".tkh-banner-img").first().boundingBox();
  const card = await page.locator(".tkh-banner-copy").boundingBox();
  const search = await page.locator("form.tkh-search").boundingBox();
  expect(photo).not.toBeNull();
  expect(card).not.toBeNull();
  expect(search).not.toBeNull();
  return { photo: photo!, card: card!, search: search! };
}

test.describe("H7.62: home hero below 1024 px", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const view of STACKED) {
    test(`the headline card sits below the photo at ${view.width}`, async ({ page }) => {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto("/");
      const { photo, card, search } = await boxes(page);
      expect(Math.round(photo.height)).toBe(view.photo);
      expect(card.y).toBeGreaterThanOrEqual(photo.y + photo.height - 32 - 1);
      expect(card.y).toBeGreaterThanOrEqual(photo.y + photo.height * 0.85);
      expect(search.y).toBeGreaterThanOrEqual(card.y + card.height);
      expect(await hasHorizontalScroll(page)).toBe(false);
      const radius = await page.locator(".tkh-banner-img").first().evaluate((img) => getComputedStyle(img.parentElement!.tagName === "PICTURE" ? img.parentElement! : img).borderTopLeftRadius);
      expect(radius).toBe("24px");
    });
  }

  test("at 1440 the headline card still sits on the photo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const { photo, card } = await boxes(page);
    expect(Math.round(photo.height)).toBe(420);
    expect(card.y).toBeGreaterThanOrEqual(photo.y);
    expect(card.y + card.height).toBeLessThanOrEqual(photo.y + photo.height);
  });

  test("on a phone the cookie banner is a compact bar at the bottom and leaves the photo and the headline clear", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("nl-cookies"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.locator(".tkc-banner");
    await expect(bar).toBeVisible();
    const barBox = (await bar.boundingBox())!;
    const { photo } = await boxes(page);
    const headline = (await page.locator(".tkh-banner-copy h1").boundingBox())!;
    expect(barBox.height).toBeLessThanOrEqual(844 * 0.3 + 1);
    expect(Math.round(barBox.y + barBox.height)).toBe(844);
    expect(barBox.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    expect(barBox.y).toBeGreaterThanOrEqual(headline.y + headline.height);
    await expect(bar.getByRole("button", { name: "Accept all" })).toBeVisible();
  });
});
