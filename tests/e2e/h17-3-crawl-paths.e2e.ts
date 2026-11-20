import { expect, firstAdPath, hasHorizontalScroll, test } from "./helpers";

const FEED = "/dating/bengaluru/";
// A list with more than one page (the category page lists every city).
const LONG_LIST = "/dating/";

test.describe("H17.3 crawl paths", () => {
  test("the list has numbered page links as real anchors, and page 2 names itself in title, heading and canonical", async ({ page }) => {
    await page.goto(LONG_LIST);
    const pager = page.locator("[data-tk=pager] nav a[href*='?page=']");
    await expect(pager.first()).toBeAttached();
    const hrefs = await pager.evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
    expect(hrefs.some((href) => /\?page=2$/.test(href))).toBe(true);
    expect(await page.title()).not.toContain("(page");

    await page.goto(`${LONG_LIST}?page=2`);
    expect(await page.title()).toMatch(/\(page 2\)/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("(page 2)");
    const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
    expect(canonical).toMatch(/\/dating\/\?page=2$/);
    // The current page is plain text; the first page and the others are links.
    await expect(page.locator("[data-tk=pager] [aria-current=page]")).toHaveText("2");
    await expect(page.locator("[data-tk=pager] nav a[rel=prev]")).toHaveAttribute("href", /\/dating\/$/);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("an ad page links on to the rest of the city", async ({ page }) => {
    const old = await firstAdPath(page, FEED);
    await page.goto(old);
    const link = page.locator("[data-tk=more-in-city] a");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText(/^More ads in Bengaluru$/);
    await expect(link).toHaveAttribute("href", /\/cities\/bengaluru\/$/);
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    expect(await hasHorizontalScroll(page)).toBe(false);
    // Shots for the report at the three widths (the folder is git-ignored).
    for (const [name, width, height] of [["390", 390, 844], ["768", 768, 1024], ["1440", 1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await link.scrollIntoViewIfNeeded();
      expect(await hasHorizontalScroll(page), `${name} px: no sideways scroll`).toBe(false);
      await page.screenshot({ path: `.shots/H17.3/ad-more-in-city-${name}.png` });
    }
    const href = (await link.getAttribute("href")) as string;
    const opened = await page.goto(href);
    expect(opened?.status()).toBe(200);
  });

  test("search result pages are never indexed", async ({ page }) => {
    await page.goto("/search/?q=a");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toMatch(/noindex/);
  });
});
