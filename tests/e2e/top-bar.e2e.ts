import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

const INK = "rgb(74, 45, 94)";
const WHITE = "rgb(255, 255, 255)";

function crawlOffset(page: Page) {
  return page.evaluate(() => {
    const track = document.querySelector('[data-tk="top-bar-crawl"] > div');
    return track ? new DOMMatrix(getComputedStyle(track).transform).m41 : 0;
  });
}

function linkColor(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).evaluate((node) => getComputedStyle(node).color);
}

test.describe("H7.51 top bar", () => {
  test("the phone pill calls the support number and the bar never scrolls sideways", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator('[data-tk="top-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar.getByText("Advertisers online now")).toBeVisible();
    await expect(bar.locator('[data-tk="top-bar-phone"]')).toHaveAttribute("href", "tel:+91912345678");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("wide screens show three pills and a crawl that moves and pauses on hover", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "wide screens only");
    await page.goto("/");
    const crawl = page.locator('[data-tk="top-bar-crawl"]');
    await expect(crawl).toBeVisible();
    await expect(page.locator(".tkh-ub-pill:visible")).toHaveCount(3);
    const first = await crawlOffset(page);
    await page.waitForTimeout(1000);
    const second = await crawlOffset(page);
    expect(second).toBeLessThan(first);
    await crawl.hover();
    const paused = await crawlOffset(page);
    await page.waitForTimeout(600);
    expect(await crawlOffset(page)).toBe(paused);
    const barBox = await page.locator('[data-tk="top-bar"] .tkh-utility-in').boundingBox();
    const rowBox = await page.locator(".tkn-header-row").boundingBox();
    expect(Math.abs(barBox!.x - rowBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(barBox!.width - rowBox!.width)).toBeLessThanOrEqual(1);
  });

  test("phones show the first pill and the phone pill only", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone-390", "phones only");
    await page.goto("/");
    await expect(page.locator(".tkh-ub-pill:visible")).toHaveCount(1);
    await expect(page.locator('[data-tk="top-bar-crawl"]')).toBeHidden();
    await expect(page.locator('[data-tk="top-bar-phone"]')).toBeVisible();
  });

  test("the top bar passes axe with no serious or critical issues", async ({ page }) => {
    await page.goto("/");
    const result = await new AxeBuilder({ page }).include('[data-tk="top-bar"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  });
});

test.describe("H7.51 island nav", () => {
  test("Home stays readable while the pill is on another link, and the pill returns when the pointer leaves", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "wide screens only");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect.poll(() => linkColor(page, "Home")).toBe(WHITE);

    for (const name of ["Categories", "Cities", "How it works", "Help"]) {
      await nav.getByRole("link", { name, exact: true }).hover();
      await expect.poll(() => linkColor(page, name)).toBe(WHITE);
      await expect.poll(() => linkColor(page, "Home")).toBe(INK);
    }

    const cities = await nav.getByRole("link", { name: "Cities", exact: true }).boundingBox();
    const how = await nav.getByRole("link", { name: "How it works", exact: true }).boundingBox();
    await nav.getByRole("link", { name: "Cities", exact: true }).hover();
    await page.mouse.move((cities!.x + cities!.width + how!.x) / 2, cities!.y + cities!.height / 2, { steps: 4 });
    await expect.poll(() => linkColor(page, "Home")).toBe(INK);

    await page.mouse.move(10, 400);
    await expect.poll(() => linkColor(page, "Home")).toBe(WHITE);
    await expect.poll(() => linkColor(page, "Help")).toBe(INK);
  });
});

test.describe("H7.51 support number", () => {
  test("the footer and the contact page use the support number and the Telegram name", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-tk="footer"]');
    await expect(footer.getByRole("link", { name: /^WhatsApp *[+]91/ })).toHaveAttribute("href", "https://wa.me/91912345678");
    await expect(footer.getByRole("link", { name: /^Telegram *@/ })).toHaveAttribute("href", "https://t.me/tharkoo_support");
    await expect(footer).toContainText("+91 912345678");
    await expect(footer).toContainText("@tharkoo_support");
    await expect(footer).not.toContainText(/[[]YOUR (PHONE|WHATSAPP|TELEGRAM)/);

    await page.goto("/contact/");
    await expect(page.getByRole("link", { name: /Open WhatsApp/ })).toHaveAttribute("href", "https://wa.me/91912345678");
    await expect(page.getByRole("link", { name: /Call us/ })).toHaveAttribute("href", "tel:+91912345678");
    await expect(page.getByRole("link", { name: "@tharkoo_support", exact: true })).toHaveAttribute("href", "https://t.me/tharkoo_support");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
