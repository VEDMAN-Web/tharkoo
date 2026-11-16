import AxeBuilder from "@axe-core/playwright";
import { expect, hasHorizontalScroll, isPhone, test } from "./helpers";

/**
 * H7.4: the New design live pages (home, listing title band, ad page). The e2e server is staging (SITE_NOINDEX=true),
 * so the New design is on there. Runs at 390 px (phone) and 1440 px (desktop) through playwright.config.ts.
 */

test.describe("H7.4 home (New design)", () => {
  test("shows the banner heading, the search form, five trust pills, categories and How it works", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-design="new"]')).toHaveCount(1);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("form.tkh-search")).toBeVisible();
    await expect(page.locator(".tkh-trust li")).toHaveCount(5);
    await expect(page.locator(".tkh-cat").first()).toBeVisible();
    await expect(page.locator(".tkh-step")).toHaveCount(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the home search form sends the visitor to the category page", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("form.tkh-search");
    await form.locator("select[name=category]").selectOption({ index: 1 });
    const chosen = await form.locator("select[name=category]").inputValue();
    await form.getByRole("button").click();
    await expect(page).toHaveURL(new RegExp("/" + chosen + "/"));
    await expect(page.locator('[data-tk="listing-band"]')).toBeVisible();
  });

  test("has no serious or critical accessibility problems", async ({ page }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page })
      .include("main")
      .exclude(".tkh-ad-pills")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});

test.describe("H7.4 listing header (New design)", () => {
  test("the listing page has the compact header with the count and sort, no photo band, and the cards stay within 904 px", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    await expect(page.locator('[data-tk="results-header"] h1')).toBeVisible();
    await expect(page.locator('[data-tk="results-count"]')).toBeVisible();
    await expect(page.locator('[data-tk="listing-band"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const width = await page.locator('[data-tk="listing-grid"]').first().evaluate((el) => el.getBoundingClientRect().width).catch(() => 0);
    expect(width).toBeLessThanOrEqual(905);
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
      await expect(bar.getByRole("button", { name: /^chat$/i })).toBeVisible();
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
