import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, test, withLocalDb } from "./helpers";

/**
 * H7.4d: live follow-ups from the www review. Flags are drawn (no emoji), the footer brand spacing, the phone chips row,
 * and the rule that every menu and pop-up closes on a click outside it and on Escape. One test per place.
 * The old-design menus (listing breadcrumb menu, account popover) only exist with the New design switched off, so those
 * tests switch it off in the in-memory test database and put it back afterwards.
 */

async function setNewDesign(on: boolean) {
  await withLocalDb((db) => db.collection("sites").updateOne({ key: "default" }, { $set: { newDesign: on } }, { upsert: true }));
}

async function anyAdPath(page: Page, feed: string) {
  await page.goto(feed);
  const link = page.locator('[data-tk=card] a[href*="/ad/"]').first();
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

test.describe("H7.4d: flags and footer", () => {
  test("the country pill draws an SVG flag, not an emoji", async ({ page }) => {
    test.skip(isPhone(page), "on phones the country list sits in the drawer");
    await page.goto("/");
    const pill = page.locator("header.tkn-header .tkn-city").first();
    await expect(pill).toBeVisible();
    await expect(pill.locator('img.tkn-flag[src$=".svg"]')).toHaveCount(1);
    expect(await pill.textContent()).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  test("the footer brand: 12px from the logo row to the text, 12px from the text to the chips (P1, as the mockup)", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer.tkn-footer");
    await footer.scrollIntoViewIfNeeded();
    const gaps = await footer.locator(".tkn-foot-brand").evaluate((brand) => {
      const logo = brand.querySelector(".tkn-brand")!.getBoundingClientRect();
      const about = brand.querySelector(".tkn-foot-about")!.getBoundingClientRect();
      const pills = brand.querySelector(".tkn-pills")!.getBoundingClientRect();
      return { logoToAbout: Math.round(about.top - logo.bottom), aboutToPills: Math.round(pills.top - about.bottom) };
    });
    expect(gaps).toEqual({ logoToAbout: 12, aboutToPills: 12 });
  });
});

test.describe("H7.4d: phone home chips", () => {
  test("the five trust chips are one row that scrolls sideways, each on one line", async ({ page }) => {
    test.skip(!isPhone(page), "phone layout only");
    await page.goto("/");
    const row = page.locator("ul.tkh-trust");
    await expect(row).toBeVisible();
    const chips = row.locator("li");
    const count = await chips.count();
    const layout = await row.evaluate((list) => {
      const items = [...list.querySelectorAll("li")].map((li) => li.getBoundingClientRect());
      const tops = new Set(items.map((box) => Math.round(box.top)));
      return { rows: tops.size, heights: items.map((box) => Math.round(box.height)), overflowX: getComputedStyle(list).overflowX };
    });
    expect(layout.rows).toBe(1);
    expect(layout.overflowX).toBe("auto");
    expect(layout.heights.every((height) => height <= 48)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe("H7.4d: menus close on an outside click and on Escape", () => {
  test("the listing breadcrumb menu (old design) closes on an outside click and on Escape", async ({ page }) => {
    await setNewDesign(false);
    try {
      await page.goto("/dating/mumbai/");
      const trigger = page.locator("nav.tk-crumbs button[aria-expanded]:visible").first();
      await expect(trigger).toBeVisible();
      await trigger.click();
      const menu = page.locator(".tk-crumb-menu:visible").first();
      await expect(menu).toBeVisible();
      await page.locator("h1.tk-listing-h1").click({ position: { x: 2, y: 2 } });
      await expect(menu).toHaveCount(0);
      await trigger.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    } finally {
      await setNewDesign(true);
    }
  });

  test("the account popover (old design) closes on an outside click and on Escape", async ({ page }) => {
    await setNewDesign(false);
    try {
      await page.goto("/");
      const account = page.locator('button[aria-label="Account"]:visible').first();
      await expect(account).toBeVisible();
      await account.click();
      const menu = page.locator(".tk-menu:visible").first();
      await expect(menu).toBeVisible();
      await page.locator("h1").first().click({ position: { x: 2, y: 2 } });
      await expect(menu).toHaveCount(0);
      await account.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    } finally {
      await setNewDesign(true);
    }
  });

  test("the chat panel closes on Escape, and an outside click does not close an open chat", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const seller = await newUserApi(baseURL!, "chatseller");
    await seller.api.dispose();
    await loginUi(page, seller.email);
    const adPath = await anyAdPath(page, "/property/bengaluru/");
    await page.goto(adPath);
    const chat = page.locator("[data-tk=chat]:visible").first();
    test.skip((await chat.count()) === 0, "no chat button on this ad for this visitor");
    await chat.click();
    const panel = page.locator("[data-tk=chat-panel]");
    await expect(panel).toBeVisible();
    await page.locator("h1").first().click({ position: { x: 2, y: 2 } });
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

  test("the search modal closes on Escape and on a click on the backdrop", async ({ page }) => {
    await page.goto("/");
    // P1: the home header has no search button, so the pop-up opens through the same event the listing pages use.
    const open = () => page.evaluate(() => window.dispatchEvent(new Event("tk-open-search")));
    await open();
    const modal = page.locator('[data-tk=search-modal]');
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await open();
    await expect(modal).toBeVisible();
    await page.locator(".tk-modal-back").click({ position: { x: 4, y: 4 } });
    await expect(modal).toHaveCount(0);
  });
});
