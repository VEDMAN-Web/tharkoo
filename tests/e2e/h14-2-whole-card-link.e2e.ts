import { mkdirSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test } from "./helpers";

/** H14.2: the whole ad card is the link. Home card and its hover pop-out (the other places are covered in their own specs). */

const SHOTS = process.env.H142_SHOTS_DIR ?? "";
const ROW = '[data-tk="ads-row"]';
const CARD = '[data-tk="home-ad"]';

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const row = page.locator(ROW);
  await row.scrollIntoViewIfNeeded();
  const card = row.locator(CARD).first();
  await expect(card).toBeVisible();
  return card;
}

/**
 * The click events the page sends for an ad (one per open is the rule). The page sends them with sendBeacon just before it
 * navigates, so they are written down inside the page (they survive the page change) and read back from there.
 */
async function watchClicks(page: Page) {
  await page.addInitScript(() => {
    const note = (body: unknown) => {
      void (async () => {
        const text = body instanceof Blob ? await body.text() : String(body ?? "");
        const found = (text.match(/"type":"click"/g) ?? []).length;
        if (found) localStorage.setItem("__clicks", String(Number(localStorage.getItem("__clicks") ?? "0") + found));
      })();
    };
    const beacon = navigator.sendBeacon?.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (String(url).includes("/api/views/")) note(data);
      return beacon ? beacon(url, data) : false;
    };
  });
  return async () => Number(await page.evaluate(() => localStorage.getItem("__clicks") ?? "0"));
}

async function backToHome(page: Page) {
  await page.goBack();
  await page.waitForLoadState("networkidle");
  const card = page.locator(ROW).locator(CARD).first();
  await card.scrollIntoViewIfNeeded();
  return card;
}

test.describe("H14.2 whole ad card is the link", () => {
  test("Home card: photo, title, empty space each open the ad with one click event; the heart does not; Tab then Enter opens it with a ring", async ({ page }) => {
    test.setTimeout(240_000);
    const clicks = await watchClicks(page);
    let card = await openHome(page);
    await shot(page, "home-card");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await card.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
    await expect(page.getByText("View ad", { exact: true })).toHaveCount(0);

    // A2: the heart saves, it does not open the ad.
    const heart = card.locator(".tkh-heart");
    await heart.click();
    await expect(page).toHaveURL(/\/$/);
    await heart.click();

    // A1: photo, title and the empty space of the text area.
    const targets: ((c: Locator) => Locator)[] = [(c) => c.locator(".tkh-ad-photo"), (c) => c.locator(".tkh-ad-link"), (c) => c.locator(".tkh-ad-body")];
    for (const [round, target] of targets.entries()) {
      const before = await clicks();
      const place = target(card);
      const box = (await place.boundingBox())!;
      // The centre of the photo and of the title; the empty right-hand side of the text area (no pill or text there).
      const position = round === 2 ? { x: box.width - 10, y: 8 } : { x: box.width / 2, y: box.height / 2 };
      await place.click({ position });
      await expect(page).toHaveURL(/\/ad\//);
      await page.waitForTimeout(400);
      expect((await clicks()) - before, `one click event for opening from target ${round}`).toBe(1);
      card = await backToHome(page);
    }

    // A4: Tab until the title link has focus, the card shows a ring, Enter opens the ad.
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    let focused = false;
    for (let step = 0; step < 120 && !focused; step += 1) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => document.activeElement?.classList.contains("tkh-ad-link") ?? false);
    }
    expect(focused, "Tab reaches the title link of a card").toBe(true);
    const ring = await page.evaluate(() => {
      const link = document.activeElement as HTMLElement;
      const cardNode = link.closest(".tkh-ad") as HTMLElement;
      const style = getComputedStyle(cardNode);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    await shot(page, "home-card-focus");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ad\//);
  });

  test("hover pop-out: no View button; the whole pop-out opens the ad; heart does not; one click event", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "mouse only");
    test.setTimeout(180_000);
    const clicks = await watchClicks(page);
    const card = await openHome(page);
    await card.hover();
    const pop = page.locator('[data-tk="home-ad-popout"]');
    await expect(pop).toBeVisible({ timeout: 3000 });
    await shot(page, "home-popout");
    await expect(pop.getByRole("link", { name: "View ad" })).toHaveCount(0);
    expect(await pop.evaluate((node) => getComputedStyle(node).cursor)).toBe("pointer");
    // The heart in the pop-out does not open the ad.
    const heart = pop.locator(".tkh-heart");
    if (await heart.count()) {
      await heart.click();
      await expect(page).toHaveURL(/\/$/);
      await heart.click();
    }
    // Empty space of the pop-out text area opens the ad.
    const body = pop.locator(".tkh-pop-body");
    const box = (await body.boundingBox())!;
    await body.click({ position: { x: box.width - 8, y: 8 } });
    await expect(page).toHaveURL(/\/ad\//);
    await page.waitForTimeout(400);
    expect(await clicks(), "one click event for opening from the pop-out").toBe(1);
  });
});
