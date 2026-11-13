import { expect, hasHorizontalScroll, test } from "./helpers";

test.describe("Countries", () => {
  test("all-countries page lists countries with one h1 and no sideways scroll", async ({ page }) => {
    await page.goto("/countries/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText(/all countries/i);
    expect(await page.locator(".tk-panel").count()).toBeGreaterThan(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("footer countries block opens to cities and links to all countries", async ({ page }) => {
    await page.goto("/");
    const block = page.locator("[data-tk=footer-countries]");
    await expect(block).toBeVisible();
    await block.locator("summary").first().click();
    expect(await block.locator("details[open] a").count()).toBeGreaterThan(0);
    await expect(block.getByRole("link", { name: /all countries/i })).toHaveAttribute("href", "/countries/");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
