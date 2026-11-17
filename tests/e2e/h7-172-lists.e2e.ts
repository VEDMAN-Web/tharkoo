import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test } from "./helpers";

/** H7.172 part 1: All ads (sticky bulk bar, thumbnails, Demo word), Users (Demo word) and wallet rows (ad title). */

const SHOTS = process.env.H7172_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

test.describe("H7.172 lists, part 1", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("All ads: a picture or a placeholder on every row, the demo account reads Demo, and the bulk bar stays in view while scrolling at 1440 (phones do not select rows)", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    for (const [size, top] of [[{ width: 1440, height: 900 }, 60], [{ width: 390, height: 844 }, 0]] as const) {
      await page.setViewportSize(size);
      await page.goto("/admin/ads/");
      const rows = page.locator('[data-tk="server-table"] tbody tr');
      await expect(rows.first()).toBeVisible();
      const count = await rows.count();
      expect(await page.locator('[data-tk="ad-thumb"], [data-tk="ad-nothumb"]').count()).toBe(count);
      if (size.width > 767) await expect(rows.first().getByText("Demo", { exact: true }).first()).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "all-ads");
      if (size.width <= 767) continue;
      await rows.first().locator('input[type="checkbox"]').check();
      await page.evaluate(() => window.scrollTo(0, 700));
      const bar = page.locator('[data-tk="bulk-bar"]');
      await expect(bar).toBeVisible();
      const box = await bar.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(top - 2);
      expect(box!.y).toBeLessThanOrEqual(top + 4);
      await shot(page, "all-ads-selected");
    }
  });

  test("Users: the built-in demo account reads Demo", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/users/");
      await expect(page.locator('[data-tk="server-table"] tbody').getByText("Demo", { exact: true })).toBeVisible();
      await expect(page.locator('[data-tk="server-table"] tbody').getByText("Seed", { exact: true })).toHaveCount(0);
      if (size.width > 767) {
        await expect(page.locator('[data-tk="user-city"]').first()).toHaveText("Not set");
        await expect(page.locator('[data-tk="server-table"] tbody').getByText("unknown", { exact: true })).toHaveCount(0);
      }
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "users");
    }
  });
});
