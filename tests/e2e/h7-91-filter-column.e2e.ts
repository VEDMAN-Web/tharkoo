import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ObjectId } from "mongodb";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

const countOf = (text: string) => Number((text.match(/[\d,]+/) || ["0"])[0].replace(/,/g, ""));

async function recordWebm(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start();
    for (let frame = 0; frame < 20; frame += 1) {
      context.fillStyle = `hsl(${frame * 18}, 70%, 50%)`;
      context.fillRect(0, 0, 64, 64);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await done;
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  });
  return Buffer.from(base64, "base64");
}

async function addCardVideos(page: Page, slugs: string[]) {
  const bytes = await recordWebm(page);
  mkdirSync(join(process.cwd(), "public", "uploads"), { recursive: true });
  const files: string[] = [];
  const ids: ObjectId[] = [];
  for (const slug of slugs) {
    const name = `${new ObjectId().toHexString()}.webm`;
    writeFileSync(join(process.cwd(), "public", "uploads", name), bytes);
    files.push(name);
    const done = await withLocalDb(async (db) => {
      const listing = await db.collection("listings").findOne({ slug });
      const _id = new ObjectId();
      await db.collection("media_assets").insertOne({
        _id,
        ownerId: listing!.ownerId,
        listingId: listing!._id,
        kind: "video",
        objectKey: `/uploads/${name}`,
        status: "cleared",
        contentType: "video/webm",
        createdAt: new Date(),
      });
      return _id;
    });
    expect(done, "E2E_MONGO_URI_FILE must point at the in-memory database").toBeTruthy();
    ids.push(done!);
  }
  return async () => {
    for (const name of files) rmSync(join(process.cwd(), "public", "uploads", name), { force: true });
    await withLocalDb((db) => db.collection("media_assets").deleteMany({ _id: { $in: ids } }));
  };
}

const SEARCH_CACHE_MS = 10_500;

const playingCount = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLVideoElement>('[data-tk="card-video"]')].filter((video) => !video.paused).length);

test.describe("H7.91: sticky, instant filter column and phone sheet", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  test("a quick filter applies at once and the live count follows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const show = page.locator('[data-tk="show-count"]');
    await expect(show).toBeHidden();
    await expect(show).toHaveText(/^Show [\d,]+ ads?$/);
    const before = countOf(await page.locator('[data-tk="results-count"]').innerText());
    expect(countOf(await show.innerText())).toBe(before);
    await page.locator(".tkn-ls-aside").getByText("Verified", { exact: true }).click();
    await expect(page).toHaveURL(/verified=1/);
    await expect(page.locator('[data-chip="verified"]')).toBeVisible();
    const after = countOf(await page.locator('[data-tk="results-count"]').innerText());
    expect(after).toBeLessThanOrEqual(before);
    await expect.poll(async () => countOf(await show.innerText())).toBe(after);
  });

  test("the column is compact and stays in view while the results scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const aside = page.locator(".tkn-ls-aside");
    const box = (await aside.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(800);
    const selects = aside.locator(".tkn-ls-select select");
    for (let i = 0; i < (await selects.count()); i += 1) {
      expect((await selects.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    const state = (await aside.locator(".tkn-ls-select").nth(1).boundingBox())!;
    const city = (await aside.locator(".tkn-ls-select").nth(2).boundingBox())!;
    expect(Math.abs(state.y - city.y)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);
    const scrolled = (await aside.boundingBox())!;
    expect(scrolled.y).toBeGreaterThanOrEqual(60);
    expect(scrolled.y).toBeLessThanOrEqual(110);
    expect(scrolled.y + scrolled.height).toBeLessThanOrEqual(900);
  });

  test("on a phone the bar sticks under the header and Filters opens a full-height sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/?category=dating&city=surat");
    await expect(page.locator('[data-tk="active-chips"]')).toBeVisible();
    await expect(page.locator(".tkn-ls-aside")).not.toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    const bar = (await page.locator('[data-tk="results-bar"]').boundingBox())!;
    expect(bar.y).toBeGreaterThanOrEqual(60);
    expect(bar.y).toBeLessThanOrEqual(90);
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    const aside = page.locator(".tkn-ls-aside");
    await expect(aside).toHaveAttribute("data-open", "true");
    expect((await aside.boundingBox())!.height).toBeGreaterThanOrEqual(800);
    await aside.getByText("Verified", { exact: true }).click();
    await expect(page).toHaveURL(/verified=1/);
    await expect(aside).toHaveAttribute("data-open", "true");
    await page.locator('[data-tk="show-count"]').click();
    await expect(aside).toHaveAttribute("data-open", "false");
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("the sheet closes with its close button and with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/");
    const aside = page.locator(".tkn-ls-aside");
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    await expect(aside).toHaveAttribute("data-open", "true");
    await aside.locator(".tkn-ls-sheet-close").click();
    await expect(aside).toHaveAttribute("data-open", "false");
    await page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn').click();
    await page.keyboard.press("Escape");
    await expect(aside).toHaveAttribute("data-open", "false");
  });

  test("category pages get the same phone bar and the sticky column", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dating/");
    await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dating/");
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);
    const aside = (await page.locator(".tkn-ls-aside").boundingBox())!;
    expect(aside.y).toBeGreaterThanOrEqual(60);
    expect(aside.y).toBeLessThanOrEqual(110);
  });

  test("the number of active filters equals the number of chips, on the column and on the phone button", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&city=surat&verified=1&online=1");
    await expect(page.locator('[data-tk="active-chips"] .tkn-sr-chip')).toHaveCount(4);
    await expect(page.locator(".tkn-ls-aside .tkn-ls-pill")).toHaveText("4");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-tk="results-bar"] .tkn-ls-filter-btn')).toContainText("Filters \u00b7 4");
  });

  test("the keyword placeholder fits the column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/");
    const input = page.locator(".tkn-kw input");
    await expect(input).toHaveAttribute("placeholder", "Search keyword");
    const fits = await input.evaluate((el) => {
      const probe = document.createElement("span");
      const cs = getComputedStyle(el);
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`;
      probe.textContent = (el as HTMLInputElement).placeholder;
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width <= el.clientWidth - 46;
    });
    expect(fits).toBe(true);
  });

  test("an empty result says that ads close by are shown, and the post button is a real button", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/search/?category=dating&city=surat&online=1&verified=1&video=1");
    await expect(page.locator('[data-tk="results-count"]')).toHaveText("0 ads in Surat \u00b7 showing ads close by");
    const button = page.locator('[data-tk="fallback-lead"] .tk-btn');
    await expect(button).toBeVisible();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("gradient");
    const lead = (await page.locator('[data-tk="fallback-lead"]').boundingBox())!;
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(lead.x + lead.width - 40);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search/?category=dating&city=surat&online=1&verified=1&video=1");
    const phoneButton = (await page.locator('[data-tk="fallback-lead"] .tk-btn').boundingBox())!;
    const phoneLead = (await page.locator('[data-tk="fallback-lead"]').boundingBox())!;
    expect(phoneButton.width).toBeGreaterThan(phoneLead.width - 50);
  });

  for (const size of [
    { width: 1366, height: 768 },
    { width: 1536, height: 730 },
    { width: 1536, height: 674 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    for (const path of ["/search/?category=dating&state=gujarat", "/dating/surat/"]) {
      test(`the filter column never scrolls and fits the window at ${size.width}x${size.height} on ${path}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(path);
        const aside = page.locator(".tkn-ls-aside");
        const measure = () =>
          aside.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, top: el.getBoundingClientRect().top }));
        const fit = async (label: string) => {
          const box = (await aside.boundingBox())!;
          const m = await measure();
          expect(m.scroll, `${label}: no scrollbar`).toBeLessThanOrEqual(m.client);
          expect(box.height, `${label}: at most 500 px`).toBeLessThanOrEqual(500);
          expect(box.height, `${label}: fits the window`).toBeLessThanOrEqual(size.height - 70 - 32);
          expect(Math.round(box.width)).toBe(272);
          const inner = await page.locator(".tkn-ls-form .tkn-ls-acc").evaluate((el) => el.scrollHeight - el.clientHeight);
          expect(inner, `${label}: the accordion list does not scroll`).toBeLessThanOrEqual(1);
        };
        await fit("closed");
        const rows = page.locator(".tkn-ls-row-btn");
        expect(await rows.count()).toBeGreaterThan(0);
        for (let i = 0; i < (await rows.count()); i += 1) {
          await rows.nth(i).click();
          await expect(rows.nth(i)).toHaveAttribute("aria-expanded", "true");
          expect(await page.locator('.tkn-ls-row-btn[aria-expanded="true"]').count()).toBe(1);
          await fit(`row ${i} open`);
        }
        expect(await hasHorizontalScroll(page)).toBe(false);
      });
    }
  }

  test("the column starts closed: header with count, keyword, selects, 2x2 toggles and accordions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&state=gujarat");
    const aside = page.locator(".tkn-ls-aside");
    await expect(aside.locator(".tkn-ls-panelhead-title")).toContainText("Filters");
    await expect(aside.locator(".tkn-ls-label")).toHaveCount(0);
    await expect(aside.locator(".tkn-ls-go")).toBeHidden();
    await expect(aside.locator('.tkn-ls-select select[aria-label="Area"]')).toHaveCount(0);
    await expect(aside.locator('select[aria-label="Category"] option').first()).toHaveText("All categories");
    const toggles = aside.locator(".tkn-ls-chipline");
    expect(await toggles.count()).toBeGreaterThanOrEqual(4);
    const first = (await toggles.nth(0).boundingBox())!;
    const second = (await toggles.nth(1).boundingBox())!;
    const third = (await toggles.nth(2).boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
    expect(third.y).toBeGreaterThan(first.y + 30);
    expect(Math.round(first.height)).toBe(36);
    await expect(aside.locator('.tkn-ls-row-btn[aria-expanded="true"]')).toHaveCount(0);
    for (const control of await aside.locator("select, .tkn-kw input, .tkn-ls-row").all()) {
      expect(Math.round((await control.boundingBox())!.height)).toBe(40);
    }
    const choice = aside.locator(".tkn-ls-row", { has: page.locator(".tkn-ls-opt") }).first();
    await choice.locator(".tkn-ls-row-btn").click();
    await choice.locator(".tkn-ls-opt").first().click();
    await expect(page).toHaveURL(/f\./);
    await expect(choice.locator(".tkn-ls-row-btn")).toContainText("· 1");
  });

  test("a list card has photo arrows on hover that never open the ad, and the photo itself opens it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const card = page.locator('[data-tk="card"]').first();
    const next = card.locator(".tk-cc-arrow.next");
    await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(5, 5);
    await expect(next).toBeHidden();
    await card.hover();
    await expect(next).toBeVisible();
    await page.waitForTimeout(400);
    const box = (await next.boundingBox())!;
    expect(Math.round(box.width)).toBe(32);
    expect(Math.round(box.height)).toBe(32);
    const url = page.url();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(card.locator(".tk-cc-dots i").nth(1)).toHaveClass(/on/);
    const prev = (await card.locator(".tk-cc-arrow.prev").boundingBox())!;
    await page.mouse.click(prev.x + prev.width / 2, prev.y + prev.height / 2);
    await expect(card.locator(".tk-cc-dots i").nth(0)).toHaveClass(/on/);
    expect(page.url()).toBe(url);
    await card.locator(".tkn-ls-photo").click({ position: { x: 100, y: 120 } });
    await expect(page).toHaveURL(/\/ad\//);
  });

  test("on a touch screen the photo arrows are always visible", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/search/?category=dating");
    const arrow = page.locator('[data-tk="card"]').first().locator(".tk-cc-arrow.next");
    await expect(arrow).toBeVisible();
    await context.close();
  });

  test("a list card shows no views or clicks and is about 200 px high with a 200 px photo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating");
    const card = page.locator('[data-tk="card"]').first();
    await expect(page.locator('[data-tk="ad-counts"]')).toHaveCount(0);
    await expect(card).not.toContainText(/\bviews?\b|\bclicks?\b/);
    const box = (await card.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(190);
    expect(box.height).toBeLessThanOrEqual(225);
    const photo = (await card.locator(".tkn-ls-photo").boundingBox())!;
    expect(Math.round(photo.width)).toBe(200);
    expect(await card.locator(".tkn-ls-photo img").first().evaluate((el) => getComputedStyle(el).objectPosition)).toBe("50% 18%");
  });

  test("a card with a video shows a play badge and plays muted on hover only", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&sort=newest");
    const slug = (await page.locator('[data-tk="card"] a.tkn-ls-stretch').first().getAttribute("href"))!.replace(/^\/ad\//, "").replace(/\/$/, "");
    const cleanup = await addCardVideos(page, [slug]);
    try {
      await page.waitForTimeout(SEARCH_CACHE_MS);
      await page.goto("/search/?category=dating&sort=newest&verified=0");
      const card = page.locator('[data-tk="card"]', { has: page.locator('a.tkn-ls-stretch[href="/ad/' + slug + '/"]') });
      await expect(card.locator('[data-tk="video-badge"]')).toBeVisible();
      const video = card.locator('[data-tk="card-video"]');
      expect(await video.evaluate((el: HTMLVideoElement) => el.muted)).toBe(true);
      expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
      await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await card.hover();
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused)).toBe(true);
      await expect(video).toHaveAttribute("data-live", "true");
      await page.mouse.move(2, 2);
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
      await expect(video).toHaveAttribute("data-live", "false");
    } finally {
      await cleanup();
    }
  });

  test("on a phone the video autoplays muted when the card is on screen, one at a time, and pauses off screen", async ({ page, browser, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search/?category=dating&sort=newest&online=0");
    const slugs = (await page.locator('[data-tk="card"] a.tkn-ls-stretch').evaluateAll((links) => links.slice(0, 3).map((link) => link.getAttribute("href") ?? ""))).map((href) =>
      href.replace(/^\/ad\//, "").replace(/\/$/, ""),
    );
    const cleanup = await addCardVideos(page, slugs);
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const reduced = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    try {
      await page.waitForTimeout(SEARCH_CACHE_MS);
      const view = await phone.newPage();
      await view.goto("/search/?category=dating&sort=newest&online=0");
      await expect.poll(() => playingCount(view), { timeout: 15_000 }).toBe(1);
      expect(await playingCount(view)).toBeLessThanOrEqual(1);
      await view.evaluate(() => window.scrollTo(0, 5000));
      await view.waitForTimeout(800);
      expect(await playingCount(view)).toBeLessThanOrEqual(1);
      await view.evaluate(() => window.scrollTo(0, 0));
      await view.evaluate(() => document.querySelectorAll('[data-tk="card-video"]').length);
      const still = await reduced.newPage();
      await still.goto("/search/?category=dating&sort=newest&online=0");
      await expect(still.locator('[data-tk="video-badge"]').first()).toBeVisible();
      await still.waitForTimeout(1_500);
      expect(await playingCount(still)).toBe(0);
    } finally {
      await phone.close();
      await reduced.close();
      await cleanup();
    }
  });
});
