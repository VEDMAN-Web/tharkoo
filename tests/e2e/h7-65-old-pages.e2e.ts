import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, registerApi, test, uniqueEmail } from "./helpers";

async function noHeaderLogIn(page: Page) {
  await expect(page.locator('[data-tk="header-avatar"]').first()).toBeVisible();
  await expect(page.locator('header [data-tk="login"], header a[href="/u/login/"]')).toHaveCount(0);
}

test.describe("H7.65: old-design public pages", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("/u/register/ goes to the login page and keeps next", async ({ page }) => {
    await page.goto("/u/register/");
    await expect(page).toHaveURL(/\/u\/login\/$/);
    await page.goto("/u/register/?next=%2Fu%2Fpost-insert%2F");
    await expect(page).toHaveURL(/\/u\/login\/\?next=%2Fu%2Fpost-insert%2F$/);
  });

  for (const width of [1440, 768, 390]) {
    test(`/countries/ is a New design page with India first at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto("/countries/");
      await expect(page.locator('[data-tk="listing-band"]')).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".tk-banner")).toHaveCount(0);
      const cards = page.locator('[data-tk="country-card"]');
      expect(await cards.count()).toBeGreaterThan(0);
      await expect(cards.first().locator("h2")).toContainText("India");
      await expect(cards.first().locator(".tkn-co-count")).toHaveText(/\d[\d,]* ads?/);
      await expect(cards.first().locator("svg.tkn-flag, .tkn-flag").first()).toBeVisible();
      expect(await cards.first().locator("a.tk-pill").count()).toBeGreaterThan(1);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("a blog post without headings reads in one column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/blog/");
    const href = await page.locator('a[href^="/blog/"]:not([href="/blog/"])').first().getAttribute("href");
    await page.goto(href!);
    const article = page.locator(".tkp-article");
    await expect(article).toBeVisible();
    const box = (await article.boundingBox())!;
    expect(box.width).toBeGreaterThan(600);
    expect(box.width).toBeLessThanOrEqual(761);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("search, district and tag pages show the signed-in header", async ({ page, baseURL }) => {
    const email = uniqueEmail("hdr");
    await registerApi(page.request, baseURL!, email);
    await loginUi(page, email);
    await page.goto("/search/");
    await noHeaderLogIn(page);
    await page.goto("/dating/surat/choryasi/");
    await noHeaderLogIn(page);
    const tag = await page.locator('a[href*="/tag/"]').first().getAttribute("href");
    if (tag) {
      await page.goto(tag);
      await noHeaderLogIn(page);
    }
  });
});
