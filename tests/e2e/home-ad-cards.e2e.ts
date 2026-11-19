import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, test, withLocalDb } from "./helpers";

const ROW = '[data-tk="ads-row"]';
const CARD = '[data-tk="home-ad"]';

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const row = page.locator(ROW);
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator(CARD).first()).toBeVisible();
  return row;
}

const PHOTO_WAIT = 90_000;

/**
 * Home shows the eight newest ads, so ads that other specs post without photos can push every card with 2+ photos
 * off the row. When none is shown, pin one seeded ad with 2+ photos to Home (the feed is cached for a minute) and
 * give it back at the end.
 */
async function openHomeWithPhotoCard(page: Page, pick: (row: Locator) => Locator) {
  let row = await openHome(page);
  if (await pick(row).count()) return { row, restore: async () => undefined };
  const pinned = await withLocalDb(async (db) => {
    const ad = await db.collection("listings").findOne({ status: "active", "mediaIds.1": { $exists: true } }, { projection: { homeShow: 1, homeOrder: 1 } });
    if (!ad) return null;
    await db.collection("listings").updateOne({ _id: ad._id }, { $set: { homeShow: true, homeOrder: -1_000_000 } });
    return { id: ad._id, homeShow: ad.homeShow === true, homeOrder: typeof ad.homeOrder === "number" ? ad.homeOrder : 0 };
  });
  const restore = async () => {
    if (!pinned) return;
    await withLocalDb((db) => db.collection("listings").updateOne({ _id: pinned.id }, { $set: { homeShow: pinned.homeShow, homeOrder: pinned.homeOrder } }));
  };
  await expect
    .poll(
      async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        row = page.locator(ROW);
        return pick(row).count();
      },
      { timeout: PHOTO_WAIT, intervals: [3000] },
    )
    .toBeGreaterThan(0);
  return { row, restore };
}

test.describe("H7.84 home ad cards", () => {
  test("eight cards in a grid, no tag, no views, no big button, pills are category and city only", async ({ page }) => {
    const row = await openHome(page);
    await expect(row).toHaveAttribute("aria-label", "Latest ads");
    await expect(row.locator(":scope > li")).toHaveCount(8);
    await expect(row.locator(".tkh-ad-badge")).toHaveCount(0);
    await expect(row.locator(".tkh-ad-views")).toHaveCount(0);
    await expect(row.locator(".tkh-ad-more")).toHaveCount(0);
    const text = (await row.innerText()).toLowerCase();
    expect(text).not.toMatch(/super top|\bstar\b|\bviews?\b|view details/);
    const pills = await row.locator(CARD).evaluateAll((cards) => cards.map((card) => [...card.querySelectorAll(".tkh-ad-body .tkh-pill")].map((pill) => pill.textContent || "")));
    for (const set of pills) {
      expect(set.length).toBeGreaterThanOrEqual(1);
      expect(set.length).toBeLessThanOrEqual(2);
      for (const label of set) expect(label).not.toContain("/");
    }
  });

  test("the title is one line with an ellipsis (up to two lines on a phone), 15 px (14 px on a phone) and 600", async ({ page }) => {
    const row = await openHome(page);
    const style = await row.locator(".tkh-ad-title").first().evaluate((node) => {
      const css = getComputedStyle(node);
      return { overflow: css.textOverflow, wrap: css.whiteSpace, size: css.fontSize, weight: css.fontWeight };
    });
    const phone = (page.viewportSize()?.width ?? 1440) < 640;
    expect(style).toEqual({ overflow: "ellipsis", wrap: phone ? "normal" : "nowrap", size: phone ? "14px" : "15px", weight: "600" });
  });

  test("the heart sits on the photo, top right, 32 px with a 44 px tap area, and fills when saved", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    const photo = (await card.locator(".tkh-ad-photo").boundingBox())!;
    const heart = card.locator(".tkh-ad-photo .tkh-heart");
    const box = (await heart.boundingBox())!;
    expect(Math.round(box.width)).toBe(32);
    expect(Math.round(box.height)).toBe(32);
    await heart.scrollIntoViewIfNeeded();
    const hitSlop = await heart.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const hit = (x: number, y: number) => {
        const found = document.elementFromPoint(x, y);
        return found === node || node.contains(found);
      };
      return [hit(rect.left - 5, rect.top + 16), hit(rect.right + 5, rect.top + 16), hit(rect.left + 16, rect.top - 5), hit(rect.left + 16, rect.bottom + 5)];
    });
    expect(hitSlop).toEqual([true, true, true, true]);
    expect(Math.round(photo.x + photo.width - (box.x + box.width))).toBeLessThanOrEqual(14);
    expect(Math.round(box.y - photo.y)).toBeLessThanOrEqual(14);
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  test("the photo carousel has arrows and dots, and the arrow moves to the next picture", async ({ page }) => {
    test.setTimeout(PHOTO_WAIT + 60_000);
    const { row, restore } = await openHomeWithPhotoCard(page, (list) => list.locator(CARD).filter({ has: page.locator(".tkh-ad-dots") }));
    try {
      const card = row.locator(CARD).filter({ has: page.locator(".tkh-ad-dots") }).first();
      await expect(card).toBeVisible();
      await card.hover();
      const next = card.getByRole("button", { name: "Next photo" });
      await expect(next).toBeVisible();
      const count = card.locator(".tkh-ad-count");
      const before = Number(((await count.innerText()).match(/^(\d+)\//) || [])[1]);
      await next.click();
      await expect(count).toHaveText(new RegExp(`^${before + 1}/`));
      await expect(card.locator(".tkh-ad-dots i.is-on")).toHaveCount(1);
      const position = await card.locator(".tkh-ad-slide img").first().evaluate((node) => getComputedStyle(node).objectPosition);
      expect(position).toBe("50% 18%");
    } finally {
      await restore();
    }
  });

  test("a click on the card (not the heart, arrows or pills) opens the ad", async ({ page }) => {
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    const href = await card.locator(".tkh-ad-title a").getAttribute("href");
    await card.locator(".tkh-ad-title").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("the ads are a grid with no section arrows: 4 by 2 on a computer, 2 by 4 under 1024 px", async ({ page }, testInfo) => {
    const row = await openHome(page);
    await expect(page.getByRole("button", { name: "Previous ads" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next ads" })).toHaveCount(0);
    const tops = await row.locator(CARD).evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top + window.scrollY)));
    const rows = new Set(tops).size;
    const perRow = tops.filter((top) => top === tops[0]).length;
    if (testInfo.project.name === "desktop-1440") {
      expect([rows, perRow]).toEqual([2, 4]);
    } else {
      expect([rows, perRow]).toEqual([4, 2]);
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("a Home card is at most 330 px high on a computer, three to a row from 900 to 1199 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
    await page.setViewportSize({ width: 1440, height: 900 });
    let row = await openHome(page);
    const tall = await row.locator(CARD).evaluateAll((cards) => Math.max(...cards.map((card) => card.getBoundingClientRect().height)));
    expect(tall).toBeLessThanOrEqual(330);
    await page.setViewportSize({ width: 1000, height: 800 });
    row = await openHome(page);
    const tops = await row.locator(CARD).evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top + window.scrollY)));
    expect(tops.filter((top) => top === tops[0]).length).toBe(3);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the hover pop-out shows after a short wait on a mouse, and goes away on leave", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    const row = await openHome(page);
    const card = row.locator(CARD).first();
    await card.hover();
    const pop = page.locator('[data-tk="home-ad-popout"]');
    await expect(pop).toBeVisible({ timeout: 3000 });
    if (await card.locator('[data-tk="availability"]').count()) {
      // The pop-out's own Chat button, not any link whose name contains "chat" (an ad titled "chatflow ..." has one).
      const chat = pop.locator('[data-tk="pop-chat"]');
      await expect(chat).toBeVisible();
      await expect(chat).toHaveText("Chat");
    }
    // H14.2: no View ad button; the whole pop-out opens the ad through its title link.
    await expect(pop.getByRole("link", { name: "View ad" })).toHaveCount(0);
    await expect(pop.locator(".tkh-pop-link")).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(pop).toHaveCount(0);
  });

  test("a touch screen never shows the pop-out", async ({ browser, baseURL }) => {
    test.setTimeout(PHOTO_WAIT + 60_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL });
    await context.addInitScript(() => {
      localStorage.setItem("nl-age", "ok");
      localStorage.setItem("nl-cookies", "necessary");
    });
    const page = await context.newPage();
    const { row, restore } = await openHomeWithPhotoCard(page, (list) => list.locator(CARD).filter({ has: page.getByRole("button", { name: "Next photo" }) }));
    try {
      const withPhotos = row.locator(CARD).filter({ has: page.getByRole("button", { name: "Next photo" }) }).first();
      await expect(withPhotos).toBeVisible();
      await withPhotos.hover();
      await page.waitForTimeout(800);
      await expect(page.locator('[data-tk="home-ad-popout"]')).toHaveCount(0);
      await expect(withPhotos.getByRole("button", { name: "Next photo" })).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
    } finally {
      await restore();
      await context.close();
    }
  });

  test("the ads block passes axe with no serious or critical issues", async ({ page }) => {
    await openHome(page);
    const result = await new AxeBuilder({ page }).include("#home-fresh").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = result.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(bad.map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    if (isPhone(page)) expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
