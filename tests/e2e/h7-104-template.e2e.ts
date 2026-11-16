import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

const PAGES = ["/search/?category=dating", "/dating/", "/dating/surat/", "/jobs/", "/vehicles/gujarat/", "/cities/surat/"];
const CARD = '[data-tk="home-ad"]';

async function cardTops(page: Page) {
  return page.locator(CARD).evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top + window.scrollY)));
}

test.describe("H7.104: one listing template for every listing page", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const path of PAGES) {
    test(`${path} at 1536x674: same header, same column, same cards, first card high up`, async ({ page }) => {
      await page.setViewportSize({ width: 1536, height: 674 });
      await page.goto(path);
      await expect(page.locator('[data-tk="results-header"] h1')).toHaveCount(1);
      await expect(page.locator('[data-tk="results-count"]')).toBeVisible();
      await expect(page.locator('[data-tk="listing-band"]')).toHaveCount(0);
      await expect(page.locator(".tkn-ls-searchrow")).toHaveCount(0);
      await expect(page.locator(".tkn-ls-aside .tkn-kw input")).toHaveCount(1);
      await expect(page.locator('input[type="search"]')).toHaveCount(1);

      const aside = page.locator(".tkn-ls-aside");
      const box = (await aside.boundingBox())!;
      expect(Math.round(box.width)).toBe(272);
      expect(box.height).toBeLessThanOrEqual(500);
      expect(await aside.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);

      await expect(page.locator('[data-tk="card"]')).toHaveCount(0);
      const cards = page.locator(CARD);
      expect(await cards.count()).toBeGreaterThan(0);
      const text = (await page.locator('[data-tk="listing-grid"]').first().innerText()).toLowerCase();
      expect(text).not.toMatch(/\bstar\b|super top|\btop\b/);
      const tops = await cardTops(page);
      expect(tops[0], "first card top").toBeLessThanOrEqual(260);
      if (tops.length >= 3) expect(tops.filter((top) => top === tops[0]).length, "3 cards in the first row").toBe(3);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("a category page counts its own category: Filters 1 and a Category chip that leads to /search/", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/dating/");
    await expect(page.locator(".tkn-ls-aside .tkn-ls-pill")).toHaveText("1");
    const chip = page.locator('[data-chip="category"]');
    await expect(chip).toContainText("Category: Dating");
    await expect(chip).toHaveAttribute("href", "/search/");
    await page.goto("/dating/surat/?verified=1");
    await expect(page.locator(".tkn-ls-aside .tkn-ls-pill")).toHaveText(/^[3-4]$/);
    await expect(page.locator('[data-chip="category"]')).toHaveAttribute("href", /\/search\/\?.*city=surat/);
    await expect(page.locator('[data-chip="category"]')).toHaveAttribute("href", /verified=1/);
  });

  test("a category page and its search page show the same filter state", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.goto("/search/?category=dating&city=surat");
    const search = await page.locator(".tkn-ls-aside .tkn-ls-pill").innerText();
    const chips = await page.locator('[data-tk="active-chips"] .tkn-sr-chip').allInnerTexts();
    await page.goto("/dating/surat/");
    expect(await page.locator(".tkn-ls-aside .tkn-ls-pill").innerText()).toBe(search);
    expect((await page.locator('[data-tk="active-chips"] .tkn-sr-chip').allInnerTexts()).map((text) => text.replace(/\s*×\s*$/, ""))).toEqual(chips.map((text) => text.replace(/\s*×\s*$/, "")));
  });

  test("on a phone every listing page has the sticky Filters bar, two cards per row and no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn'), path).toBeVisible();
      await expect(page.locator('[data-tk="listing-band"]'), path).toHaveCount(0);
      const tops = await cardTops(page);
      expect(tops.length, path).toBeGreaterThan(0);
      if (tops.length >= 2) expect(tops.filter((top) => top === tops[0]).length, `${path} two per row`).toBe(2);
      expect(await hasHorizontalScroll(page), path).toBe(false);
    }
  });

  test("the pages pass axe", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 674 });
    for (const path of ["/dating/", "/cities/surat/"]) {
      await page.goto(path);
      const issues = (await new AxeBuilder({ page }).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id);
      expect(issues, path).toEqual([]);
    }
  });

  test("the admin switch brings the photo band back", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1536, height: 674 });
    await signInAdminContext(context, baseURL!);
    const toggle = async (on: boolean) => {
      await page.goto("/admin/homepage/");
      const box = page.getByLabel("Show photo band on listing pages");
      await expect(box).toBeVisible();
      if ((await box.isChecked()) !== on) await box.setChecked(on);
      await expect(page.getByText("Saved.", { exact: true }).last()).toBeVisible();
    };
    await toggle(true);
    try {
      await expect(async () => {
        await page.goto("/dating/");
        await expect(page.locator('[data-tk="listing-band"]')).toHaveCount(1, { timeout: 2_000 });
      }).toPass({ timeout: 150_000, intervals: [5_000] });
    } finally {
      await toggle(false);
    }
  });
});
