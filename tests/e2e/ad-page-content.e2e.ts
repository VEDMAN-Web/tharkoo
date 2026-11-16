import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, slugFromAdPath, test, withLocalDb } from "./helpers";

const SHOTS = process.env.AD_PAGE_SHOTS_DIR || "";
const SIZES = [
  [1366, 768],
  [1536, 730],
  [1536, 674],
  [1440, 900],
  [390, 844],
  [360, 740],
] as const;
const CARD_MAX = 380;
const GAP_MAX = 56;

async function adAt(page: Page, feed: string, position = 0) {
  await page.goto(feed);
  const link = page.locator('[data-tk=card] a[href*="/ad/"]').nth(position);
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function setTour(enabled: boolean) {
  await withLocalDb((db) => db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: enabled, videoTourCoins: 2 } }));
}

async function similarGapToFooter(page: Page) {
  return page.evaluate(() => {
    const similar = document.querySelector(".tkn-similar")!.getBoundingClientRect();
    const footer = document.querySelector('footer[data-tk="footer"]')!.getBoundingClientRect();
    return footer.top - similar.bottom;
  });
}

test.describe("H7.99b ad page content", () => {
  test("one content card: no views or clicks, pills, plain three-column details, wide container", async ({ page }, testInfo) => {
    const href = await adAt(page, "/property/bengaluru/");
    await page.goto(href);
    const card = page.locator('[data-tk="ad-summary"]');
    await expect(card).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(card.locator("h1")).toHaveCSS("font-weight", "700");
    await expect(card).not.toContainText(/\b\d+\s+views?\b/i);
    await expect(card).not.toContainText(/clicks/i);
    await expect(card.locator(".tkn-ad-meta")).toContainText("Posted");
    await expect(card.getByRole("heading", { name: "About this ad", level: 2 })).toBeVisible();
    await expect(card.locator(".tkn-ad-pills li").first()).toBeVisible();
    const items = card.locator(".tkn-det-item");
    if ((await items.count()) > 0) {
      await expect(items.first().locator("dd")).toHaveCSS("font-weight", "600");
      await expect(items.first()).toHaveCSS("border-top-width", "0px");
      for (const text of await items.locator("dd").allInnerTexts()) expect(text).not.toMatch(/^[0-9]{5,}$/);
      if (!isPhone(page)) {
        const columns = await card.locator(".tkn-det").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
        expect(columns).toBe(3);
      }
    }
    if (testInfo.project.name === "desktop-1440") {
      const grid = await page.locator(".tkn-ad-grid").boundingBox();
      expect(Math.round(grid!.width)).toBe(1200);
      const main = await page.locator(".tkn-ad-main").boundingBox();
      const side = await page.locator(".tkn-ad-side").boundingBox();
      expect(Math.round(main!.width)).toBe(768);
      expect(Math.round(side!.width)).toBe(400);
      expect(Math.round(side!.x - (main!.x + main!.width))).toBe(32);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the right card is sticky, at most 380 px high, and fits below the header at every laptop size", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the card is a wide-screen part");
    await setTour(true);
    try {
      const href = await adAt(page, "/property/bengaluru/");
      for (const [width, height] of [
        [1366, 768],
        [1536, 730],
        [1536, 674],
        [1440, 900],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto(href);
        const card = page.locator('[data-tk="contact-card"]');
        await expect(card).toBeVisible();
        await expect(page.locator('[data-tk="contact-card"] [data-tk="tour"]')).toBeVisible();
        const sticky = page.locator(".tkn-ad-sticky");
        await expect(sticky).toHaveCSS("position", "sticky");
        const box = (await card.boundingBox())!;
        expect(box.height, `${width}x${height} card height`).toBeLessThanOrEqual(CARD_MAX);
        const headerBottom = await page.evaluate(() => document.querySelector("header")!.getBoundingClientRect().bottom);
        await page.evaluate(() => window.scrollTo(0, 260));
        await page.waitForTimeout(150);
        const moved = (await card.boundingBox())!;
        expect(moved.y, `${width}x${height} card top below header`).toBeGreaterThanOrEqual(headerBottom - 1);
        expect(moved.y + moved.height, `${width}x${height} card bottom in window`).toBeLessThanOrEqual(height);
        const safe = (await page.locator('[data-tk="security-tips"]').boundingBox())!;
        expect(safe.height).toBeLessThanOrEqual(110);
        expect(safe.y + safe.height).toBeLessThanOrEqual(height);
        await shot(page, `sticky-${width}x${height}`);
      }
    } finally {
      await setTour(false);
    }
  });

  test("the right card has the price, the advertiser rows, Call and WhatsApp side by side and a slim Stay safe box", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the card is a wide-screen part");
    await page.goto(await adAt(page, "/property/bengaluru/"));
    const card = page.locator('[data-tk="contact-card"]');
    const request = await card.locator(".tkn-ad-price").evaluate((node) => node.classList.contains("is-request"));
    await expect(card.locator(".tkn-ad-price")).toHaveCSS("font-size", request ? "20px" : "26px");
    await expect(card.locator(".tkn-seller-avatar")).toHaveCSS("width", "44px");
    await expect(card.locator(".tkn-seller-since")).toContainText("Member since");
    const call = (await card.locator("[data-tk=call]").boundingBox())!;
    const chat = (await card.locator("[data-tk=chat]").boundingBox())!;
    const whats = (await card.locator("[data-tk=whatsapp]").boundingBox())!;
    expect(Math.round(call.y)).toBe(Math.round(whats.y));
    expect(Math.abs(call.width - whats.width)).toBeLessThanOrEqual(1);
    expect(call.height).toBe(48);
    expect(chat.height).toBe(44);
    expect(chat.width).toBeGreaterThan(call.width * 1.8);
    const actions = (await card.locator('[data-tk="ad-actions"] a').boundingBox())!;
    expect(actions.height).toBeGreaterThanOrEqual(36);
    await expect(page.locator('[data-tk="security-tips"]').getByRole("link", { name: "More safety tips" })).toBeVisible();
  });

  test("similar ads use the Home ad card, at most 8, and end 48 px above the footer", async ({ page }, testInfo) => {
    const href = await adAt(page, "/property/bengaluru/");
    await page.goto(href);
    const section = page.locator('[data-tk="similar-ads"]');
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Similar ads near you");
    await expect(section.getByRole("link", { name: /^See all in/ })).toBeVisible();
    const cards = section.locator('[data-tk="home-ad"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
    await expect(section.locator(".tkh-heart").first()).toBeVisible();
    await expect(section.locator(".tkh-pill").first()).toBeVisible();
    await expect(section).not.toContainText(/views|clicks/i);
    const tops = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    const firstRow = tops.filter((top) => top === tops[0]).length;
    if (testInfo.project.name === "desktop-1440") expect(firstRow).toBe(Math.min(4, count));
    else {
      const scroller = section.locator(".tkn-similar-grid");
      expect(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    }
    await section.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await similarGapToFooter(page);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(GAP_MAX);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("below 1024 px: a 64 px bottom bar, a 24 px title with the price under it, Save and Report as icons", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone-390", "the phone layout");
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(await adAt(page, "/property/bengaluru/"));
      const bar = page.locator('[data-tk="bottom-bar"]');
      await expect(bar).toBeVisible();
      const box = (await bar.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(64);
      expect(box.height).toBeLessThanOrEqual(80);
      expect(Math.round(box.y + box.height)).toBe(740);
      for (const button of await bar.locator(".tk-btn").all()) {
        const size = (await button.boundingBox())!;
        expect(size.height).toBeGreaterThanOrEqual(44);
        expect(size.width).toBeGreaterThanOrEqual(44);
      }
      await expect(bar.getByRole("button", { name: "Chat" })).toBeVisible();
      await expect(page.locator("h1")).toHaveCSS("font-size", "24px");
      const h1 = (await page.locator("h1").boundingBox())!;
      const price = (await page.locator(".tkn-ad-phoneprice").boundingBox())!;
      expect(price.y).toBeGreaterThan(h1.y + h1.height - 1);
      const icons = page.locator('[data-tk="ad-actions-icons"]');
      await expect(icons.getByRole("button", { name: /save/i })).toBeVisible();
      await expect(icons.getByRole("link", { name: "Report this ad" })).toBeVisible();
      await expect(page.locator('[data-tk="contact-card"] [data-tk="call"]')).toBeHidden();
      expect(await hasHorizontalScroll(page)).toBe(false);
    }
  });

  test("the full-screen viewer has 52 px white arrows, a 14 px counter pill top-left and a 44 px close button", async ({ page }) => {
    await page.goto(await adAt(page, "/dating/bengaluru/"));
    await page.locator('[data-tk="gallery-expand"]').click();
    const viewer = page.locator('[data-tk="gallery-viewer"]');
    await expect(viewer).toBeVisible();
    for (const name of ["Previous photo", "Next photo"]) {
      const arrow = viewer.getByRole("button", { name });
      const box = (await arrow.boundingBox())!;
      expect(Math.round(box.width)).toBe(52);
      expect(Math.round(box.height)).toBe(52);
      await expect(arrow).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
    const counter = viewer.locator(".tkn-viewer-count");
    await expect(counter).toHaveCSS("font-size", "14px");
    await expect(counter).toHaveCSS("background-color", "rgba(17, 5, 32, 0.78)");
    const at = (await counter.boundingBox())!;
    expect(at.x).toBeLessThan(40);
    expect(at.y).toBeLessThan(40);
    const close = (await viewer.getByRole("button", { name: "Close full screen" }).boundingBox())!;
    expect(Math.round(close.width)).toBe(44);
    expect(Math.round(close.height)).toBe(44);
    await shot(page, `viewer-${isPhone(page) ? "390" : "1440"}`);
    await page.keyboard.press("Escape");
  });

  test("the Featured pill sits in the pills row and the main photo carries no tier badge", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const hrefs = await page.locator('[data-tk=card] a[href*="/ad/"]').evaluateAll((els) => els.slice(0, 10).map((el) => (el as HTMLAnchorElement).getAttribute("href")));
    let featured = 0;
    for (const href of hrefs) {
      await page.goto(href!);
      await expect(page.locator(".tkn-gal")).toBeVisible();
      await expect(page.locator(".tkn-gal .tkn-gal-badge")).toHaveCount(0);
      await expect(page.locator(".tkn-gal")).not.toContainText(/SUPER Top/);
      const pill = page.locator(".tkn-ad-pills li.is-featured");
      if (await pill.count()) {
        featured += 1;
        await expect(pill).toHaveText("Featured");
        if (featured === 1) await shot(page, `featured-${isPhone(page) ? "390" : "1440"}`);
      }
    }
    expect(featured).toBeGreaterThan(0);
  });

  test("on a phone the breadcrumb is one line with the last two crumbs", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone-390", "the phone layout");
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(await adAt(page, "/dating/bengaluru/"));
      const nav = page.locator(".tkn-ad-crumbs");
      await expect(nav).toHaveCSS("font-size", "13px");
      await expect(nav).toHaveCSS("row-gap", "4px");
      const shown = await nav.locator(":scope > span").evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").length);
      expect(shown).toBe(2);
      const box = (await nav.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual(32);
      await expect(nav.locator("a:visible").first()).toBeVisible();
      expect((await nav.innerText()).trim().startsWith("/")).toBe(false);
      await shot(page, `crumbs-${width}`);
    }
  });

  test("the page passes axe in the content, right card, similar ads and bar", async ({ page }) => {
    await page.goto(await adAt(page, "/property/bengaluru/"));
    const result = await new AxeBuilder({ page }).include(".tkn-ad").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("people categories show no price line at all, and items keep Price on request at 20 px muted", async ({ page }) => {
    let checked = 0;
    for (const feed of ["/dating/bengaluru/", "/friendship/bengaluru/", "/meetups/bengaluru/", "/personal-ads/bengaluru/"]) {
      await page.goto(feed);
      const link = page.locator('[data-tk=card] a[href*="/ad/"]').first();
      if (!(await link.count())) continue;
      await page.goto((await link.getAttribute("href"))!);
      await expect(page.locator(".tkn-contact-panel")).toBeAttached();
      await expect(page.locator(".tkn-ad-price")).toHaveCount(0);
      await expect(page.locator(".tkn-ad-phoneprice")).toHaveCount(0);
      await expect(page.getByText("Price on request")).toHaveCount(0);
      await expect(page.locator(".tkn-contact-panel > :first-child")).toHaveAttribute("data-tk", "seller-row");
      await expect(page.locator('[data-tk="security-tips"]')).toContainText("Meet in a public place");
      await expect(page.locator('[data-tk="ad-summary"]')).not.toContainText(/clicks/i);
      expect(await hasHorizontalScroll(page)).toBe(false);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test("an item without a price says Price on request at 20 px muted", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the card is a wide-screen part");
    await page.goto("/ad/demo-7920/");
    const price = page.locator(".tkn-contact-panel .tkn-ad-price");
    await expect(price).toHaveText("Price on request");
    await expect(price).toHaveCSS("font-size", "20px");
    await expect(price).toHaveCSS("font-weight", "600");
  });

  test("proof shots of the demo ad and a dating ad at the required sizes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440" || !SHOTS, "shots are taken once, on request");
    const dating = await adAt(page, "/dating/bengaluru/");
    for (const [name, href] of [
      ["demo-7920", "/ad/demo-7920/"],
      [`dating-${slugFromAdPath(dating)}`, dating],
    ] as const) {
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await page.goto(href);
        await expect(page.locator('[data-tk="new-ad"]')).toBeVisible();
        await shot(page, `${name}-${width}x${height}-top`);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(250);
        await shot(page, `${name}-${width}x${height}-bottom`);
      }
    }
  });
});
