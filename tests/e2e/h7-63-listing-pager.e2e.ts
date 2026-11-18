import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

async function slugs(page: Page) {
  return page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) a[href*="/ad/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
}

test.describe("H7.63: listing pager", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("page 2 of a category shows ads 16 to 30, as real links", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/");
    const first = await slugs(page);
    const pager = page.locator('[data-tk="pager"]');
    await expect(pager).toBeVisible();
    await expect(pager.locator("p")).toHaveText(/^Showing 1.15 of \d+ ads$/);
    await expect(pager.locator(".is-current")).toHaveAttribute("aria-current", "page");
    await expect(pager.locator(".tkp-prev")).toHaveAttribute("aria-disabled", "true");
    const link = pager.locator('a.tkp-num[href="/dating/?page=2"]');
    await expect(link).toHaveCount(1);

    await page.goto("/dating/?page=2");
    await expect(page.locator('[data-tk="pager"] p')).toHaveText(/^Showing 16.30 of \d+ ads$/);
    const second = await slugs(page);
    expect(second.filter((href) => first.includes(href))).toEqual([]);
    expect(await page.locator('head link[rel="prev"]').getAttribute("href")).toMatch(/\/dating\/$/);
    expect(await page.locator('head link[rel="canonical"]').getAttribute("href")).toMatch(/\/dating\/\?page=2$/);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("a click on a page keeps the filters and the page beyond the last is not found", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/?verified=1");
    const next = page.locator('[data-tk="pager"] a.tkp-next');
    if (await next.count()) {
      await expect(next).toHaveAttribute("href", /verified=1/);
      await expect(next).toHaveAttribute("href", /page=2/);
    }
    const response = await page.goto("/dating/?page=999");
    expect(response?.status()).toBe(404);
  });

  test("on a phone the pager is two half-width buttons with the page text between", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dating/?page=2");
    const pager = page.locator('[data-tk="pager"] nav');
    await expect(pager.locator(".tkp-status")).toHaveText(/^Page 2 of \d+$/);
    await expect(pager.locator(".tkp-num").first()).toBeHidden();
    const prev = (await pager.locator(".tkp-prev").boundingBox())!;
    const next = (await pager.locator(".tkp-next").boundingBox())!;
    expect(prev.height).toBeGreaterThanOrEqual(44);
    expect(next.height).toBeGreaterThanOrEqual(44);
    expect(prev.width).toBeGreaterThan(100);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
