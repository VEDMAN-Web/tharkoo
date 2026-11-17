import { expect, hasHorizontalScroll, test } from "./helpers";

const NOTES = /draft for review|demo queries|if you want the page indexed|placeholder graphics/i;

test.describe("H7.69: visitor-facing text clean-up", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const path of ["/terms/", "/privacy/", "/cookies/", "/contact/", "/blog/most-searched-hyderabad/", "/help/photos/", "/cms/grievance/"]) {
    test(`${path} shows no notes to the team`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(await page.locator("body").innerText()).not.toMatch(NOTES);
    });
  }

  test("an unknown /cms/ page is a real 404 and a known one is not", async ({ page }) => {
    const missing = await page.goto("/cms/nonexistent/");
    expect(missing?.status()).toBe(404);
    const about = await page.goto("/cms/about/");
    expect(about?.status()).toBe(200);
  });

  for (const width of [1440, 390]) {
    test(`a blog post shows its cover band above the article at ${width}: 200 px without a photo, at most 380 px with one`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto("/blog/stay-safe/");
      const cover = page.locator('[data-tk="blog-cover"]');
      await expect(cover).toBeVisible();
      const box = (await cover.boundingBox())!;
      const article = (await page.locator(".tkp-article").boundingBox())!;
      if ((await cover.getAttribute("data-cover")) === "photo") {
        expect(Math.round(box.height)).toBeGreaterThan(200);
        expect(Math.round(box.height)).toBeLessThanOrEqual(380);
      } else {
        expect(Math.round(box.height)).toBe(200);
      }
      expect(box.y + box.height).toBeLessThanOrEqual(article.y + 1);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("the 404 page is a 404 with a title", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});
