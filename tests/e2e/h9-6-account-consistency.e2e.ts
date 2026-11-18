import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";
import { createLiveAd } from "./flows";

/**
 * H9.6: the account pages share one heading style, one card shape, no text under 12 px, no tap target under 24 px, and whole rupees.
 * The Account home, My ads and the Seller profile are left out here: they are being changed by their own cards.
 */

const SHOTS = process.env.H96_SHOTS_DIR ?? "";
const PAGES = ["/u/account/messages/", "/u/account/saved/", "/u/account/credits/", "/u/account/wallet/", "/u/account/credits/history/", "/u/account/notifications/", "/u/account/alerts/", "/u/account/support/", "/u/account/edit-account/", "/u/account/media/", "/u/account/kyc/", "/u/account/analytics/", "/u/account/coupons/", "/u/account/subscription/", "/u/account/delete/"];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** What breaks the rules on the page now: headings, small text, small targets, rupee decimals, panel shape. */
async function problems(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const found: string[] = [];
    const main = document.querySelector("main") ?? document.body;
    const headings = [...document.querySelectorAll("h1")].filter(visible);
    if (headings.length !== 1) found.push(`h1 count ${headings.length}`);
    for (const h of headings) {
      const style = getComputedStyle(h);
      if (style.fontSize !== "20px" || style.fontWeight !== "800" || /Cormorant|Georgia|Times/.test(style.fontFamily)) found.push(`h1 style ${style.fontSize}/${style.fontWeight}/${style.fontFamily.slice(0, 20)}`);
    }
    for (const el of main.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, [role=radio], [role=tab]")) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      const inText = el.tagName === "A" && getComputedStyle(el).display === "inline";
      if ((rect.height < 24 || rect.width < 24) && !inText) found.push(`small target ${el.tagName} "${(el.textContent || "").trim().slice(0, 20)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || seen.has(el) || !visible(el)) continue;
      seen.add(el);
      if (parseFloat(getComputedStyle(el).fontSize) < 12) found.push(`small text "${node.textContent.trim().slice(0, 20)}"`);
    }
    if (/₹[0-9,]*\.[0-9]{2}\b/.test(main.textContent || "")) found.push("rupee decimals");
    for (const panel of document.querySelectorAll("section.up-panel")) {
      const style = getComputedStyle(panel);
      if (style.borderRadius !== "20px" || style.paddingTop !== "22px") found.push(`panel ${style.borderRadius} ${style.paddingTop}`);
    }
    return found;
  });
}

test.describe("H9.6 account consistency", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("every account page: one heading style, 20 px panels, no small text, no small targets, axe clean, no sideways scroll, at 1440 and 390", async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await createLiveAd(page, baseURL!, "h96");
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.waitForTimeout(500);
        expect(await problems(page), `${size.width} ${path}`).toEqual([]);
        expect(await hasHorizontalScroll(page), `${size.width} ${path} sideways scroll`).toBe(false);
        expect(await serious(page), `${size.width} ${path} axe`).toEqual([]);
        if (["/u/account/coupons/", "/u/account/media/", "/u/account/subscription/", "/u/account/wallet/"].includes(path)) await shot(page, path.split("/")[3]);
      }
    }
  });
});
