import { expect, hasHorizontalScroll, test } from "./helpers";

const PAGES = [
  "/search/",
  "/search/?state=gujarat",
  "/search/?q=dating",
  "/search/?category=dating",
  "/search/?category=dating&state=gujarat",
  "/search/?category=dating&city=surat",
  "/cities/surat/",
  "/dating/",
  "/dating/gujarat/",
  "/dating/surat/",
  "/dating/surat/choryasi/",
];

test.describe("H7.75: every search and listing page has the shared body", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const path of PAGES) {
    test(`${path} has the header, the filter column and the list at the shared width`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('[data-tk="results-header"]')).toBeVisible();
      const aside = (await page.locator(".tkn-ls-aside").first().boundingBox())!;
      const main = (await page.locator(".tkn-ls-main").first().boundingBox())!;
      expect(Math.round(aside.width)).toBe(272);
      expect(main.x).toBeGreaterThan(aside.x + aside.width);
      expect(Math.round(main.width)).toBeLessThanOrEqual(904);
      expect(Math.round(main.width)).toBeGreaterThanOrEqual(760);
      expect(await page.locator('[data-tk="home-ad"]').count()).toBeGreaterThan(0);
      const pagesNote = await page.locator('[data-tk="pager"] .tkp-showing').count();
      if (pagesNote) await expect(page.locator('[data-tk="pager"] .tkp-showing')).toHaveText(/^Showing 1-\d+ of \d+ ads$/);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("a search with words and a state keeps them in the panel links and the pager", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?state=gujarat");
    await expect(page.locator('[data-tk="pager"] a.tkp-next')).toHaveAttribute("href", /state=gujarat/);
    await expect(page.locator('.tkn-ls-form input[type="hidden"][name="state"]')).toHaveValue("gujarat");
    const response = await page.goto("/search/?state=gujarat&page=2");
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tk="pager"] .tkp-showing')).toHaveText(/^Showing 16-30 of \d+ ads$/);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("on a phone the search page has the Filters button and no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/");
    await expect(page.locator(".tkn-ls-filter-btn")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
