import { mkdirSync } from "node:fs";
import { expect, hasHorizontalScroll, test } from "./helpers";

const SHOTS = process.env.H7153_SHOTS_DIR || "";

test.describe("H7.153 the search page fits a phone when there are no results", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  for (const width of [360, 390]) {
    test(`/search/ with no results has no sideways scroll at ${width} and has no Sort menu (H19.1)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/search/?q=zzzzqqqqxx");
      await expect(page.locator('[data-tk="results-count"]')).toContainText("0 ads");
      expect(await hasHorizontalScroll(page)).toBe(false);
      await expect(page.locator(".tkn-sr-sort")).toHaveCount(0);
      if (SHOTS && width === 390) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/search-none-390x844.png` });
      }
    });
  }

  test("a search with results and the laptop view are unchanged: one line count, no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/?q=tutoring");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?q=zzzzqqqqxx");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const count = page.locator('[data-tk="results-count"]');
    expect((await count.boundingBox())!.height).toBeLessThan(40);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-none-1440x900.png` });
  });
});
