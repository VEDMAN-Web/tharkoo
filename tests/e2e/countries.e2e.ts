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

  test("every link on /countries/ returns 200 (no 404 from a country link)", async ({ page, request }) => {
    await page.goto("/countries/");
    const hrefs = await page
      .locator(".tk-panel a[href]")
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href") || ""))]);
    expect(hrefs.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const href of hrefs) {
      expect(href.startsWith("/")).toBe(true);
      const res = await request.get(href);
      if (res.status() !== 200) failures.push(`${href} -> ${res.status()}`);
    }
    expect(failures).toEqual([]);
  });

  test("a country on the all-countries page opens its own country page", async ({ page }) => {
    await page.goto("/countries/");
    const link = page.locator(".tk-panel a.tk-dir-state").first();
    await expect(link).toBeAttached();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/countries\/[a-z0-9-]+\/$/);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace(/\//g, "\/")}$`));
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
