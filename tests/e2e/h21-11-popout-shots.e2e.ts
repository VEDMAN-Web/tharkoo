import { mkdirSync } from "node:fs";
import { expect, isPhone, test } from "./helpers";

/** H21.11: shots of /search/ with the row pop-out open, after (the real pop-out) and before (the old narrower box, put back by hand). */

const SHOTS = ".shots/H21.11";

for (const width of [1440, 1024]) {
  test(`the row pop-out covers its row at ${width}`, async ({ page }) => {
    test.skip(isPhone(page), "the pop-out is for a computer");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/search/");
    const row = page.locator('[data-tk="listing-row"]').nth(1);
    await row.waitFor();
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await row.hover();
    const pop = page.locator('[data-tk="listing-popout"]');
    await expect(pop).toBeVisible({ timeout: 4000 });
    await page.waitForTimeout(500);
    const rowBox = (await row.boundingBox())!;
    const box = (await pop.boundingBox())!;
    expect(box.x, "starts at or before the row").toBeLessThanOrEqual(rowBox.x + 0.5);
    expect(box.x + box.width, "ends at or after the row").toBeGreaterThanOrEqual(rowBox.x + rowBox.width - 0.5);
    expect(box.x, "inside the window").toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, "inside the window").toBeLessThanOrEqual(width);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/search-popout-after-${width}.png` });
    // The old box: 75 percent of the row plus 56 px, centred on the row (not a measure of the new code, only the "before" picture).
    await pop.evaluate((node, r) => {
      const el = node as HTMLElement;
      const w = Math.max(Math.round((r.width + 56) * 0.75), 560);
      el.style.width = `${w}px`;
      el.style.left = `${r.x + (r.width - w) / 2}px`;
    }, rowBox);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/search-popout-before-${width}.png` });
  });
}
