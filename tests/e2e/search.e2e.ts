import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

// The home page search is now three selects and a Search button; the pop-up is opened by the "tk-open-search" event.
async function openSearchPopup(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const modal = page.locator("[data-tk=search-modal]");
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event("tk-open-search")));
    await expect(modal).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return modal;
}

test.describe("2 Search", () => {
  test("pop-up opens, searches by text", async ({ page }) => {
    const modal = await openSearchPopup(page);
    await modal.locator("[data-tk=search-text]").fill("coffee");
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/\/search\/\?.*q=coffee/);
    await expect(modal).toBeHidden();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").first()).toBeVisible();
  });

  test("pop-up closes with the X and Escape", async ({ page }) => {
    const modal = await openSearchPopup(page);
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toBeHidden();
    await openSearchPopup(page);
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("search by city and category goes to the city feed", async ({ page }) => {
    const modal = await openSearchPopup(page);
    await modal.locator("[data-tk=search-city]").selectOption({ label: "Mumbai" });
    await modal.locator("[data-tk=search-category]").getByRole("button", { name: "Dating" }).click();
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/\/dating\/mumbai\/$/);
    await expect(page.locator("h1")).toContainText(/mumbai/i);
    expect(await page.locator(":is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row])").count()).toBeGreaterThan(0);
  });

  test("search by city alone keeps the city in the query", async ({ page }) => {
    const modal = await openSearchPopup(page);
    await modal.locator("[data-tk=search-text]").fill("a");
    await modal.locator("[data-tk=search-city]").selectOption({ label: "Delhi" });
    await modal.locator("[data-tk=search-submit]").click();
    await expect(page).toHaveURL(/city=delhi/);
  });

  test("the home search form goes to the clean city and category address", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("search").first();
    await form.locator("select[name=category]").selectOption({ label: "Dating" });
    await form.locator("select[name=state]").selectOption({ index: 1 });
    await form.locator("select[name=city]").selectOption({ index: 1 });
    await form.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/dating\/[a-z0-9-]+\/$/);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("an empty result says so and offers ads close by", async ({ page }) => {
    await page.goto("/search/?q=zzqxjw-no-such-thing");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByText("No ads match your search yet. Here are ads close by.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Post an ad" }).first()).toBeVisible();
    await expect(page.locator('[data-tk="results-count"]')).toContainText(/\b0\b/);
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
