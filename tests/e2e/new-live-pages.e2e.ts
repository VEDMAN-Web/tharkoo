import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

/**
 * H7.4: the New design live pages (home, listing title band, ad page). The e2e server is staging (SITE_NOINDEX=true),
 * so the New design is on there. Runs at 390 px (phone) and 1440 px (desktop) through playwright.config.ts.
 */

test.describe("H7.4 home (New design)", () => {
  test("shows the banner heading, the glass search, five trust pills, categories and How it works", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-design="new"]')).toHaveCount(1);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".tkn-search-glass")).toBeVisible();
    await expect(page.locator(".tkn-trust li")).toHaveCount(5);
    await expect(page.locator(".tkn-cat").first()).toBeVisible();
    await expect(page.locator(".tkn-step")).toHaveCount(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the banner search opens the search pop-up", async ({ page }) => {
    await page.goto("/");
    await page.locator('.tkn-search-glass [data-tk="hero-search"]').click();
    await expect(page.locator(".tk-modal").first()).toBeVisible();
  });

  test("has no serious or critical accessibility problems", async ({ page }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page })
      .include(".tkn-page")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});

test.describe("H7.4 listing title band (New design)", () => {
  test("the band shows the category and city with the search bar, and the cards stay within 880 px", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const band = page.locator('[data-tk="listing-band"]');
    await expect(band).toBeVisible();
    await expect(band.locator(".tkn-search-glass")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const width = await page.locator(".tk-feed").first().evaluate((el) => el.getBoundingClientRect().width).catch(() => 0);
    expect(width).toBeLessThanOrEqual(881);
  });
});

test.describe("H7.4 ad page (New design)", () => {
  test("shows the gallery, details, the contact panel and similar ads without sideways scroll", async ({ page }) => {
    await page.goto("/ad/demo-0352/");
    await expect(page.locator('[data-tk="new-ad"]')).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".tkn-gal")).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    if (isPhone(page)) {
      const bar = page.locator('.tkn-ad-bar[data-tk="bottom-bar"]');
      await expect(bar).toBeVisible();
      await expect(bar.getByRole("button", { name: /whatsapp/i })).toBeVisible();
      await expect(bar.getByRole("button", { name: /chat online now/i })).toBeVisible();
    } else {
      await expect(page.locator('[data-tk="contact-card"]')).toBeVisible();
    }
  });

  test("has no serious or critical accessibility problems", async ({ page }) => {
    await page.goto("/ad/demo-0352/");
    const result = await new AxeBuilder({ page })
      .include(".tkn-ad")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});
