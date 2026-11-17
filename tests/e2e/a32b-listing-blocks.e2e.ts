import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

const SHOTS = process.env.A32B_SHOTS_DIR || "";
const MARK = "A32 words from Menus & site text";

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("A32 part 2: listing blocks and UI-text words", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("a category page draws the related searches and nearby cities blocks, with working links, at laptop and phone size", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/education/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const navs = page.locator('[data-tk="listing-link-nav"]');
    await expect(navs.first()).toBeAttached();
    const nearby = page.getByRole("navigation", { name: "Nearby" });
    await expect(nearby).toBeAttached();
    const links = nearby.getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
    expect(await links.count()).toBeLessThanOrEqual(5);
    expect(await links.first().getAttribute("href")).toMatch(/^\/education\/[a-z0-9-]+\/$/);
    await expect(links.first()).toHaveClass(/tk-pill/);
    const title = nearby.locator(".tk-link-nav-title");
    expect(await title.evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
    expect(Number(await title.evaluate((node) => getComputedStyle(node).fontWeight))).toBeGreaterThanOrEqual(700);
    const row = await nearby.locator(".tk-pills").evaluate((node) => getComputedStyle(node).columnGap);
    expect(row).toBe("8px");
    expect((await links.first().boundingBox())!.height).toBeGreaterThanOrEqual(24);
    expect((await title.boundingBox())!.y).toBeLessThan((await links.first().boundingBox())!.y);
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await nearby.scrollIntoViewIfNeeded();
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/education-links-1440x900.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/education/");
    await nearby.scrollIntoViewIfNeeded();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect((await nearby.getByRole("link").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/education-links-390x844.png` });
  });

  test("the empty-search words come from Menus & site text: the built-in words first, then an override", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?q=zzzzqqqqxx");
    await expect(page.getByText("No ads match your search yet. Here are ads close by.")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-empty-1440x900.png` });
    await withLocalDb((db) => db.collection("ui_texts").updateOne({ key: "listing.empty.leadSearch" }, { $set: { key: "listing.empty.leadSearch", value: MARK, updatedBy: "e2e" } }, { upsert: true }));
    try {
      await expect(async () => {
        await page.goto("/search/?q=zzzzqqqqxx");
        await expect(page.getByText(MARK)).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 150_000, intervals: [5_000] });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/search/?q=zzzzqqqqxx");
      await expect(page.getByText(MARK)).toBeVisible();
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-empty-390x844.png` });
    } finally {
      await withLocalDb((db) => db.collection("ui_texts").deleteOne({ key: "listing.empty.leadSearch" }));
    }
  });
});
