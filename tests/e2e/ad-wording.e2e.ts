import { expect, test } from "./helpers";

const ALIAS = /\b([A-Z][a-z]+)\s*\/\s*\1 (City|District|Urban)\b/;

test.describe("H7.89 ad page words", () => {
  test("no city alias under the title or in the last crumb, and no demo seller name", async ({ page }) => {
    await page.goto("/dating/");
    const hrefs = await page.locator('[data-tk=card] a[href*="/ad/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href") || ""))].slice(0, 6));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator("h1")).toHaveCount(1);
      const crumbs = (await page.locator(".tkn-ad-crumbs").innerText()).replace(/\s+/g, " ");
      const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      expect(crumbs, href).not.toMatch(/ (City|District|Urban) (Dating|Friendship|Meetups|Personal ads|Jobs|Wellness)\s*$/);
      expect(body, href).not.toMatch(ALIAS);
      expect(body, href).not.toMatch(/\bSeed\b/);
    }
  });
});
