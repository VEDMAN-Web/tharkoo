import { expect, hasHorizontalScroll, test } from "./helpers";

test.describe("H7.70: band crumbs and city cards", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("a phone band shows only the last two crumbs, a desktop band shows the whole trail", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dating/surat/");
    const crumbs = page.locator(".tkn-ls-crumbs > span");
    const total = await crumbs.count();
    expect(total).toBeGreaterThan(2);
    const visible = await crumbs.evaluateAll((items) => items.filter((item) => getComputedStyle(item).display !== "none").map((item) => (item as HTMLElement).innerText.trim()));
    expect(visible).toHaveLength(2);
    expect(visible[0]).not.toMatch(/^\//);
    expect(await page.locator(".tkn-ls-crumbs").evaluate((nav) => nav.getBoundingClientRect().height)).toBeLessThan(30);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/surat/");
    const wide = await crumbs.evaluateAll((items) => items.filter((item) => getComputedStyle(item).display !== "none").length);
    expect(wide).toBe(total);
  });

  test("the city page keeps the category cards on a phone and drops them from 820 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cities/surat/");
    await expect(page.locator('[data-tk="city-categories"]')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cities/surat/");
    await expect(page.locator('[data-tk="city-categories"]')).toBeHidden();
    await expect(page.locator('[data-tk="city-nav-categories"] a').first()).toBeVisible();
  });

  test("the band intro uses the category name in lower case", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/friendship/");
    await expect(page.locator(".tkn-ls-intro")).toHaveText("Free friendship ads across India.");
    await page.goto("/personal-ads/surat/");
    await expect(page.locator(".tkn-ls-intro")).toHaveText("Free personal ads in Surat.");
  });
});
