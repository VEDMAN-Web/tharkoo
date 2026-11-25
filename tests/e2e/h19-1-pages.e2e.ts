import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { cleanTest, expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, realAdPath, slugFromAdPath, test, withLocalDb } from "./helpers";

/**
 * H19.1: the cookie notice hides itself, the ad pop-out is smaller and stays inside the window, no Sort menu or quick filter
 * buttons, no state picked on opening a category, the account menu closes, no gap above the footer, the chat quick buttons sit above
 * the message box, and every ad card shows views and clicks. Set SHOTS_DIR to also save a screenshot of each page.
 */

const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: `${shotsDir}/${name}-${page.viewportSize()?.width ?? 0}.png`, fullPage: false });
}

cleanTest.describe("H19.1 cookie notice", () => {
  cleanTest("hides itself after 30 seconds without an answer and stores no choice", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nl-age", "ok"));
    await page.clock.install();
    await page.goto("/");
    await page.clock.runFor(200);
    const banner = page.locator(".tkc-banner");
    await expect(banner).toBeVisible();
    await page.clock.runFor(25_000);
    await expect(banner).toBeVisible();
    await page.clock.runFor(6_000);
    await expect(banner).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("nl-cookies"))).toBeNull();
  });
});

test.describe("H19.1 listing pages", () => {
  test("no Sort menu, no quick filter buttons and no 'No filters' text on a category page", async ({ page }) => {
    for (const path of ["/dating/", "/property/", "/jobs/bengaluru/"]) {
      await page.goto(path);
      const body = await page.locator("main").innerText();
      for (const word of ["Best match", "Newest", "With photos", "With video", "Online now", "No filters for this category"]) expect(body, `${path}: ${word}`).not.toContain(word);
      await expect(page.locator("main select[aria-label*='Sort' i]")).toHaveCount(0);
      await expect(page.locator('main input[name="verified"], main input[name="photos"], main input[name="video"], main input[name="online"]')).toHaveCount(0);
      expect(await hasHorizontalScroll(page), path).toBe(false);
    }
    await shot(page, "listing-filters");
  });

  test("opening a category shows All states and All cities, not a state", async ({ page }) => {
    for (const path of ["/dating/", "/property/", "/vehicles/"]) {
      await page.goto(path);
      const state = page.locator('main select[aria-label="State"], .tkn-ls-places select').nth(1);
      await expect(state, path).toHaveValue("");
      await expect(page.locator(".tkn-ls-places select").first()).not.toHaveValue("");
    }
  });
});

test.describe("H19.1 ad pop-out", () => {
  test("the row pop-out opens inside the window even for a row at the bottom, and is smaller than the row plus its growth", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    await page.goto("/dating/bengaluru/");
    const rows = page.locator('[data-tk="listing-row"]');
    await expect(rows.first()).toBeVisible();
    const row = rows.nth(Math.min(2, (await rows.count()) - 1));
    await row.evaluate((node) => node.scrollIntoView({ block: "end" }));
    await page.evaluate(() => window.scrollBy(0, 160));
    await row.hover();
    const pop = page.locator('[data-tk="listing-popout"]');
    await expect(pop).toBeVisible({ timeout: 4000 });
    const view = page.viewportSize()!;
    const box = (await pop.boundingBox())!;
    expect(box.y, "top inside").toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, "bottom inside").toBeLessThanOrEqual(view.height);
    expect(box.x + box.width, "right inside").toBeLessThanOrEqual(view.width);
    await page.waitForTimeout(500); // the grow-in animation scales the box; measure when it has settled
    const rowBox = (await row.boundingBox())!;
    const settled = (await pop.boundingBox())!;
    expect(settled.x, "H21.11: covers the row on the left").toBeLessThanOrEqual(rowBox.x + 0.5);
    expect(settled.x + settled.width, "H21.11: covers the row on the right").toBeGreaterThanOrEqual(rowBox.x + rowBox.width - 0.5);
    await shot(page, "row-popout");
  });

  test("the Home card pop-out stays inside the window for a card at the bottom of the screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    await page.goto("/");
    const card = page.locator('[data-tk="home-ad"]').first();
    await expect(card).toBeVisible();
    await card.evaluate((node) => node.scrollIntoView({ block: "end" }));
    await card.hover();
    const pop = page.locator('[data-tk="home-ad-popout"]');
    await expect(pop).toBeVisible({ timeout: 4000 });
    const view = page.viewportSize()!;
    const box = (await pop.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
    const cardBox = (await card.boundingBox())!;
    expect(box.width, "no wider than the card plus a small growth").toBeLessThanOrEqual(cardBox.width + 8);
    await shot(page, "home-popout");
  });
});

test.describe("H19.1 account menu", () => {
  test("closes on a click elsewhere, on Escape and when the pointer reaches an ad card", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    const { email } = await newUserApi(String(testInfo.project.use.baseURL || "http://127.0.0.1:4342"), "h191");
    await loginUi(page, email, undefined, "/");
    const button = page.locator(".tkn-account > button");
    const menu = page.locator(".tkn-account-menu");
    await button.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(600, 400);
    await expect(menu).toHaveCount(0);
    await button.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await button.click();
    await expect(menu).toBeVisible();
    await shot(page, "account-menu");
    await page.locator('[data-tk="home-ad"]').first().hover();
    await expect(menu).toHaveCount(0);
  });
});

test.describe("H19.1 footer and chat", () => {
  test("no big empty space above the footer on the Home page and a listing page", async ({ page }) => {
    for (const path of ["/", "/dating/bengaluru/", "/help/"]) {
      await page.goto(path);
      const footer = page.locator('[data-tk="footer"]');
      await footer.scrollIntoViewIfNeeded();
      const gap = await page.evaluate(() => {
        const foot = document.querySelector('[data-tk="footer"]');
        if (!foot) return -1;
        const top = foot.getBoundingClientRect().top + window.scrollY;
        let bottom = 0;
        for (const el of Array.from(document.querySelectorAll("main *"))) {
          const rect = el.getBoundingClientRect();
          if (rect.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
          bottom = Math.max(bottom, rect.bottom + window.scrollY);
        }
        return Math.round(top - bottom);
      });
      expect(gap, `${path}: space between the last content and the footer`).toBeLessThanOrEqual(48);
      expect(await hasHorizontalScroll(page), path).toBe(false);
    }
    await page.goto("/");
    await page.locator('[data-tk="footer"]').scrollIntoViewIfNeeded();
    await shot(page, "footer-gap");
  });

  test("the support chat has its three quick buttons just above the message box", async ({ page }) => {
    await page.goto("/");
    await page.locator(".tkn-chat-bubble").click();
    const panel = page.locator('[data-tk="support-chat"]');
    await expect(panel).toBeVisible();
    const topics = panel.locator(".tkn-topics");
    await expect(topics.locator('[data-tk="chat-quick"]')).toHaveCount(3);
    const composer = panel.locator(".tkn-composer");
    const welcome = panel.locator(".tkn-bubble-in").first();
    const t = (await topics.boundingBox())!;
    const c = (await composer.boundingBox())!;
    const w = (await welcome.boundingBox())!;
    expect(t.y, "after the greeting").toBeGreaterThan(w.y + w.height - 1);
    expect(Math.abs(c.y - (t.y + t.height)), "touches the message box").toBeLessThanOrEqual(2);
    await shot(page, "chat-topics");
  });
});

test.describe("H19.1 views and clicks on every ad card", () => {
  test("Home cards and listing rows show an eye and a pointer with a number", async ({ page }) => {
    await page.goto("/");
    const home = page.locator('[data-tk="home-ad"]').first();
    await expect(home.locator('[data-tk="card-views"] svg')).toHaveCount(1);
    await expect(home.locator('[data-tk="card-clicks"] svg')).toHaveCount(1);
    await expect(home.locator('[data-tk="card-views"]')).toHaveText(/^\d[\d,]*$/);
    await shot(page, "home-counts");
    await page.goto("/dating/bengaluru/");
    const row = page.locator('[data-tk="listing-row"]').first();
    await expect(row.locator('[data-tk="card-views"] svg')).toHaveCount(1);
    await expect(row.locator('[data-tk="card-clicks"] svg')).toHaveCount(1);
    await expect(row.locator('[data-tk="card-clicks"]')).toHaveText(/^\d[\d,]*$/);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "row-counts");
  });

  test("opening an ad page counts a view, and pressing Call counts a click, once each per visitor", async ({ page }) => {
    test.skip(isPhone(page), "the Call button is in the sticky bar on phones; one project is enough");
    const path = await realAdPath(page);
    const slug = slugFromAdPath(path);
    const counts = async () =>
      withLocalDb(async (db) => {
        const listing = await db.collection("listings").findOne({ slug }, { projection: { _id: 1 } });
        const counter = listing ? await db.collection("ad_counters").findOne({ listingId: listing._id }) : null;
        return { views: Number(counter?.realViews ?? 0), clicks: Number(counter?.realClicks ?? 0) };
      });
    const before = await counts();
    await page.goto(path);
    await expect.poll(async () => (await counts())?.views ?? 0, { timeout: 8000 }).toBe((before?.views ?? 0) + 1);
    expect((await counts())?.clicks).toBe(before?.clicks);
    const call = page.locator('[data-tk="contact-card"] [data-tk="call"], [data-tk="call"]').first();
    await expect(call).toBeVisible();
    await call.click();
    await expect.poll(async () => (await counts())?.clicks ?? 0, { timeout: 8000 }).toBe((before?.clicks ?? 0) + 1);
  });
});
