import { expect, test } from "./helpers";

test.describe("2 Search", () => {
  test("pop-up opens, searches by text", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-tk=hero-search]").click();
    const modal = page.locator("[data-tk=search-modal]");
    await expect(modal).toBeVisible();
    await modal.locator("[data-tk=search-text]").fill("coffee");
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/\/search\/\?.*q=coffee/);
    await expect(modal).toBeHidden();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-tk=card]").first()).toBeVisible();
  });

  test("pop-up closes with the X and Escape", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-tk=hero-search]").click();
    const modal = page.locator("[data-tk=search-modal]");
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toBeHidden();
    await page.locator("[data-tk=hero-search]").click();
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("search by city and category goes to the city feed", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-tk=hero-search]").click();
    const modal = page.locator("[data-tk=search-modal]");
    await modal.locator("[data-tk=search-city]").selectOption({ label: "Mumbai" });
    await modal.locator("[data-tk=search-category]").getByRole("button", { name: "Dating" }).click();
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/\/dating\/mumbai\/$/);
    await expect(page.locator("h1")).toContainText(/mumbai/i);
    expect(await page.locator("[data-tk=card]").count()).toBeGreaterThan(0);
  });

  test("search by city alone keeps the city in the query", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-tk=hero-search]").click();
    const modal = page.locator("[data-tk=search-modal]");
    await modal.locator("[data-tk=search-text]").fill("a");
    await modal.locator("[data-tk=search-city]").selectOption({ label: "Delhi" });
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/city=delhi/);
  });

  test("empty result shows an empty state", async ({ page }) => {
    await page.goto("/search/?q=zzqxjw-no-such-thing");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-tk=card]")).toHaveCount(0);
    await expect(page.getByText(/no listings|no results|nothing found/i).first()).toBeVisible();
  });

  test("search page is noindex", async ({ page, request }) => {
    const res = await request.get("/search/?q=a");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
    await page.goto("/search/?q=a");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
