import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

const SHOTS = process.env.H7135_SHOTS_DIR || "";
const TAG = process.env.H7135_TAG || "after";
const SIZES = [
  [1440, 900],
  [390, 844],
] as const;
const INTENDED = /^"?(__)?(Manrope|Plus[_ ]Jakarta[_ ]Sans|Cormorant[_ ]Garamond)/i;

async function families(page: Page) {
  return page.evaluate(() => {
    const first = (node: Element | null) => (node ? getComputedStyle(node).fontFamily.split(",")[0].trim() : "none");
    return {
      body: first(document.body),
      text: first(document.querySelector("main p, main li, main a, p")),
      h1: first(document.querySelector("h1")),
      stack: getComputedStyle(document.body).fontFamily,
      sans: getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim(),
      display: getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim(),
    };
  });
}

test.describe("H7.135 fonts never fall back to a serif", () => {
  test("body text and the H1 start with the intended font on Home, a listing page, an ad page and the staff sign-in", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/dating/");
    const ad = await page.locator('a[data-ad-link]').first().getAttribute("href");
    expect(ad).toBeTruthy();
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      for (const path of ["/", "/dating/", ad!, "/admin/login/"]) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const found = await families(page);
        const label = `${path} at ${width}`;
        expect(found.body, `${label} body ${found.stack}`).toMatch(INTENDED);
        expect(found.text, `${label} text`).toMatch(INTENDED);
        expect(found.h1, `${label} h1`).toMatch(INTENDED);
        expect(found.stack, label).not.toMatch(/Times/i);
        expect(found.sans, `${label} --font-sans`).toMatch(/Manrope/i);
        expect(found.display, `${label} --font-display`).toMatch(/Cormorant/i);
      }
    }
  });

  test("shots of Home", async ({ page }) => {
    test.skip(!SHOTS, "set H7135_SHOTS_DIR to take shots");
    mkdirSync(SHOTS, { recursive: true });
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/${TAG}-home-${width}x${height}.png` });
    }
  });
});
