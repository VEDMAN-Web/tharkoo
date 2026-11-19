import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";
import { createLiveAd } from "./flows";

/**
 * H16.6b: under the last card of the seller dashboard (Buy credits) the space to the footer is ONE section gap plus the footer's own
 * margin, not an extra empty band (the page padding of the other account pages came on top: 152 px instead of 112 at 1440).
 * It measures at 1440, 768 and 390 and writes full-page shots when H166B_SHOTS names a folder.
 */

const SHOTS = process.env.H166B_SHOTS ?? "";
const PREFIX = process.env.H166B_PREFIX ?? "after";

async function shot(page: Page) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${PREFIX}-${page.viewportSize()?.width}.png`, fullPage: true });
}

/** The space between the last two sections of the page, from the last card to the footer, and the footer's own top margin. */
async function gaps(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector(".up-main");
    const footer = document.querySelector("footer");
    if (!main || !footer) return null;
    const sections = [...main.children].flatMap((child) => (child.classList.contains("up-dash") ? [...child.children] : [child])).filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 4);
    const last = sections[sections.length - 1].getBoundingClientRect();
    const before = sections[sections.length - 2].getBoundingClientRect();
    const foot = footer.getBoundingClientRect();
    return {
      section: Math.round((last.top - before.bottom) * 10) / 10,
      toFooter: Math.round((foot.top - last.bottom) * 10) / 10,
      footerMargin: parseFloat(getComputedStyle(footer).marginTop),
    };
  });
}

test.describe("H16.6b seller dashboard bottom space", () => {
  test("the space under the last card is one section gap plus the footer margin, at 1440, 768 and 390", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    await createLiveAd(page, baseURL!, "bottom");
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/u/account/", { waitUntil: "networkidle" });
      await expect(page.locator('[data-tk="seller-dashboard"]')).toBeVisible();
      await shot(page);
      const gap = await gaps(page);
      expect(gap, "the dashboard has cards and a footer").not.toBeNull();
      expect(gap!.section, `one section gap at ${size.width}`).toBe(size.width <= 600 ? 16 : 24);
      expect(gap!.toFooter, `the space to the footer is one section gap plus the footer margin at ${size.width}`).toBeGreaterThanOrEqual(gap!.section + gap!.footerMargin - 1);
      expect(gap!.toFooter, `and no more than that at ${size.width}`).toBeLessThanOrEqual(gap!.section + gap!.footerMargin + 1);
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });
});
