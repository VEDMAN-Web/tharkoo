import { expect, hasHorizontalScroll, test } from "./helpers";

test.describe("H7.90: compact search results page", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("/search/ has a compact header and the first ad is on the first screen at 1366 x 768", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/search/");
    await expect(page.locator('[data-tk="listing-band"]')).toHaveCount(0);
    const header = page.locator('[data-tk="results-header"]');
    await expect(header.locator("h1")).toHaveText("All ads in India");
    await expect(page.locator('[data-tk="results-count"]')).toHaveText(/^[\d,]+ ads$/);
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(140);
    const firstCard = (await page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])').first().boundingBox())!;
    expect(firstCard.y).toBeLessThan(768);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the keyword box is the first field of the filter column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?q=coffee");
    const aside = page.locator(".tkn-ls-aside");
    await expect(aside.locator(".tkn-kw label")).toHaveCount(0);
    await expect(aside.locator(".tkn-kw input")).toHaveAttribute("aria-label", "Keyword");
    await expect(aside.locator(".tkn-kw input")).toHaveAttribute("placeholder", "Search keyword");
    await expect(aside.locator(".tkn-kw input")).toHaveValue("coffee");
    await expect(page.locator('[data-tk="results-header"] h1')).toHaveText("Results for \u201ccoffee\u201d");
  });

  test("a chip removes its own filter and Clear all removes them all", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&city=surat&verified=1");
    const header = page.locator('[data-tk="results-header"]');
    await expect(header.locator("h1")).toHaveText("Dating ads in Surat");
    const chips = page.locator('[data-tk="active-chips"] .tkn-sr-chip');
    await expect(chips).toHaveText([/Category: Dating/, /City: Surat/, /Verified/]);
    await page.locator('[data-chip="verified"]').click();
    await expect(page).toHaveURL(/\/search\/\?category=dating&city=surat$/);
    await expect(page.locator('[data-chip="verified"]')).toHaveCount(0);
    await page.locator('[data-chip="city"]').click();
    await expect(page).toHaveURL(/\/search\/\?category=dating$/);
    await page.locator('[data-tk="active-chips"]').getByRole("link", { name: "Clear all" }).click();
    await expect(page).toHaveURL(/\/search\/$/);
    await expect(page.locator('[data-tk="active-chips"]')).toHaveCount(0);
  });

  test("the sort select keeps the filters and shows Verified first", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    await page.locator(".tkn-sr-sort select").selectOption("verified");
    await expect(page).toHaveURL(/category=dating&sort=verified$/);
    await expect(page.locator(".tkn-sr-sort select")).toHaveValue("verified");
    await expect(page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])').first()).toBeVisible();
  });

  test("keyword suggestions are at most six and work with the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/");
    const input = page.locator(".tkn-kw input");
    await input.click();
    await input.pressSequentially("dat");
    const options = page.locator('[data-tk="keyword-suggestions"] [role="option"]');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeLessThanOrEqual(6);
    await input.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\/\?(category|city|q)=/);
  });

  test("landing pages use the same compact header and have no photo band", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/surat/");
    await expect(page.locator('[data-tk="results-header"]')).toBeVisible();
    await expect(page.locator('[data-tk="listing-band"]')).toHaveCount(0);
  });

  test("on a phone the header is short and the Filters button opens the filter sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/");
    const header = page.locator('[data-tk="results-header"]');
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(190);
    await page.locator(".tkn-ls-filter-btn").click();
    await expect(page.locator(".tkn-ls-aside")).toHaveAttribute("data-open", "true");
    await expect(page.locator(".tkn-kw input")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
