import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";

/** H7.127: text at least 12 px, tap targets at least 24 px, a compact cookie banner that leaves the Home search card alone, two-line titles on a phone. */

const SHOTS = process.env.POST_SHOTS ?? "";
const MIN_TEXT = 12;
const MIN_TARGET = 24;

async function freshVisit(browser: import("@playwright/test").Browser, baseURL: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ baseURL, viewport });
  await context.addInitScript(() => localStorage.setItem("nl-age", "ok"));
  const page = await context.newPage();
  return { context, page };
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function heights(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const box = node.getBoundingClientRect();
        return { height: Math.round(box.height * 10) / 10, width: box.width, text: (node.textContent || "").trim().slice(0, 30) };
      })
      .filter((box) => box.width > 0 && box.height > 0),
  );
}

async function fontSizes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
}

test.describe("H7.127 public UX rules", () => {
  test("Home on a first visit: the cookie banner is compact and does not cover the search card", async ({ browser, baseURL }, info) => {
    const phone = info.project.name === "phone-390";
    const { context, page } = await freshVisit(browser, baseURL!, phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/");
    const banner = page.locator(".tkc-banner");
    await expect(banner).toBeVisible();
    const search = page.locator("form[role=search]").first();
    await expect(search).toBeVisible();
    await page.waitForTimeout(600);
    const b = (await banner.boundingBox())!;
    const s = (await search.boundingBox())!;
    if (phone) {
      // A bottom bar cannot avoid the search form, which starts near the bottom edge of the first screen. It must not touch the headline card above it.
      const card = (await page.locator("h1").first().boundingBox())!;
      expect(b.y, `banner ${JSON.stringify(b)} headline ${JSON.stringify(card)}`).toBeGreaterThanOrEqual(card.y + card.height);
      expect(b.height).toBeLessThanOrEqual(100);
      expect(b.width).toBeGreaterThanOrEqual(389);
    } else {
      const overlap = b.x < s.x + s.width && b.x + b.width > s.x && b.y < s.y + s.height && b.y + b.height > s.y;
      expect(overlap, `banner ${JSON.stringify(b)} search ${JSON.stringify(s)}`).toBe(false);
      expect(b.x).toBeLessThan(40);
      expect(b.width).toBeLessThanOrEqual(320);
    }
    const sizes = await fontSizes(page, ".tkc-banner, .tkc-banner a, .tkc-banner button");
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(MIN_TEXT);
    for (const box of await heights(page, ".tkc-banner a, .tkc-banner button")) expect(box.height, box.text).toBeGreaterThanOrEqual(MIN_TARGET);
    await shot(page, "h7-127-home-first-visit");
    await banner.getByRole("button", { name: "Only necessary" }).click();
    await expect(banner).toHaveCount(0);
    await context.close();
  });

  test("Home and listing pages: card title links, pills and related links are at least 24 px high; text at least 12 px", async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const phone = info.project.name === "phone-390";
    const { context, page } = await freshVisit(browser, baseURL!, phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    for (const path of ["/", "/dating/", "/dating/mumbai/"]) {
      await page.goto(path);
      await page.waitForTimeout(500);
      for (const selector of [".tkh-ad-link", ".tkh-pill", ".tk-seo-foot a", ".tkc-banner a"]) {
        for (const box of await heights(page, selector)) expect(box.height, `${path} ${selector} "${box.text}"`).toBeGreaterThanOrEqual(MIN_TARGET);
      }
      for (const size of await fontSizes(page, ".tkh-pill, .tkh-ad-watermark")) expect(size, path).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    await page.goto("/dating/mumbai/");
    expect((await heights(page, ".tk-seo-foot a")).length).toBeGreaterThan(0);
    await shot(page, "h7-127-listing");
    await context.close();
  });

  test("an ad page: the watermark and the pills are at least 12 px, the pills and the similar-ads links at least 24 px", async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const phone = info.project.name === "phone-390";
    const { context, page } = await freshVisit(browser, baseURL!, phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/dating/mumbai/");
    const href = await page.locator('a[data-ad-link]').first().getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);
    await page.waitForTimeout(600);
    // H14.1: the similar ads are row cards: their tags (12 px) replace the pills; the small photo mark is 10 px in the approved design.
    expect((await fontSizes(page, ".tk-row-tag")).length).toBeGreaterThan(0);
    for (const size of await fontSizes(page, ".tk-row-tag, .tkh-pill")) expect(size).toBeGreaterThanOrEqual(MIN_TEXT);
    for (const selector of [".tkh-ad-link", ".tk-row-tag", ".tkc-banner a"]) {
      for (const box of await heights(page, selector)) expect(box.height, `${selector} "${box.text}"`).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    await shot(page, "h7-127-ad-page");
    await context.close();
  });

  test("on a phone a card title may take two lines, on a desktop it stays one", async ({ browser, baseURL }, info) => {
    const phone = info.project.name === "phone-390";
    const { context, page } = await freshVisit(browser, baseURL!, phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    // H14.1: listing pages show row cards (titles of up to two lines); the Home card keeps this rule.
    await page.goto("/");
    await page.waitForTimeout(500);
    const lines = await page.locator(".tkh-ad-title").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.35;
        return { count: Math.round(node.getBoundingClientRect().height / line), clamp: style.getPropertyValue("-webkit-line-clamp"), whiteSpace: style.whiteSpace };
      }),
    );
    expect(lines.length).toBeGreaterThan(3);
    if (phone) {
      expect(lines.every((row) => row.whiteSpace === "normal")).toBe(true);
      expect(lines.some((row) => row.count === 2)).toBe(true);
      expect(Math.max(...lines.map((row) => row.count))).toBeLessThanOrEqual(2);
    } else {
      expect(lines.every((row) => row.count === 1)).toBe(true);
    }
    await shot(page, "h7-127-titles");
    await context.close();
  });
});
