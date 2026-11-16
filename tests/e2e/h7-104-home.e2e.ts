import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ObjectId } from "mongodb";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

const CARD = '[data-tk="home-ad"]';
const SLIDE_WAIT = 9_000;

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
    for (let frame = 0; frame < 25; frame += 1) {
      context.fillStyle = `hsl(${frame * 14}, 70%, 50%)`;
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

async function addVideos(page: Page, slugs: string[]) {
  const bytes = await recordWebm(page);
  mkdirSync(join(process.cwd(), "public", "uploads"), { recursive: true });
  const files: string[] = [];
  const ids: ObjectId[] = [];
  for (const slug of slugs) {
    const name = `${new ObjectId().toHexString()}.webm`;
    writeFileSync(join(process.cwd(), "public", "uploads", name), bytes);
    files.push(name);
    const id = await withLocalDb(async (db) => {
      const listing = await db.collection("listings").findOne({ slug });
      const _id = new ObjectId();
      await db.collection("media_assets").insertOne({ _id, ownerId: listing!.ownerId, listingId: listing!._id, kind: "video", objectKey: `/uploads/${name}`, status: "cleared", contentType: "video/webm", createdAt: new Date() });
      return _id;
    });
    expect(id, "E2E_MONGO_URI_FILE must point at the in-memory database").toBeTruthy();
    ids.push(id!);
  }
  return async () => {
    for (const name of files) rmSync(join(process.cwd(), "public", "uploads", name), { force: true });
    await withLocalDb((db) => db.collection("media_assets").deleteMany({ _id: { $in: ids } }));
  };
}

async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const row = page.locator('[data-tk="ads-row"]');
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator(CARD).first()).toBeVisible();
  return row;
}

const slideOf = async (page: Page, position: number) => Number(await page.locator(CARD).nth(position).getAttribute("data-slide"));

test.describe("H7.104 Home: four categories, eight smaller cards, auto-swipe", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
  });

  for (const size of [
    { width: 1440, height: 900, columns: 4 },
    { width: 1536, height: 674, columns: 4 },
    { width: 390, height: 844, columns: 2 },
  ]) {
    test(`Home shows 4 categories and 8 cards in ${size.columns} columns at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      const row = await openHome(page);
      await expect(page.locator(".tkh-cats > li")).toHaveCount(4);
      await expect(row.locator(CARD)).toHaveCount(8);
      const boxes = await row.locator(CARD).evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()));
      const tops = new Set(boxes.map((box) => Math.round(box.top)));
      expect(tops.size).toBe(8 / size.columns);
      if (size.columns === 4) {
        expect(boxes[0].width).toBeGreaterThan(255);
        expect(boxes[0].width).toBeLessThan(300);
        const photo = (await row.locator(".tkh-ad-photo").first().boundingBox())!;
        expect(Math.abs(photo.height - 300)).toBeLessThan(20);
        expect(boxes[0].height).toBeLessThan(420);
      } else {
        const photo = (await row.locator(".tkh-ad-photo").first().boundingBox())!;
        expect(Math.round(photo.height)).toBe(200);
      }
      await expect(page.getByRole("link", { name: "See all ads" }).or(page.locator(".tkh-more").last())).toBeVisible();
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  test("the number of categories is a setting in the Home page editor, default 4", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAdminContext(context, baseURL!);
    const setCount = async (value: string) => {
      await page.goto("/admin/homepage/");
      const field = page.getByLabel("Number of categories on Home (1 to 8)");
      await expect(field).toBeVisible();
      await field.fill(value);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/^Saved\./)).toBeVisible();
    };
    await page.goto("/admin/homepage/");
    await expect(page.getByLabel("Number of categories on Home (1 to 8)")).toHaveValue("4");
    await setCount("6");
    try {
      await expect(async () => {
        await page.goto("/");
        await expect(page.locator(".tkh-cats > li")).toHaveCount(6, { timeout: 2_000 });
      }).toPass({ timeout: 120_000, intervals: [5_000] });
    } finally {
      await setCount("4");
    }
  });

  test("photos swipe by themselves, 3 s each, only while the card is on screen, and pause after a click", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const card = page.locator(CARD).first();
    await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(2, 2);
    const start = await slideOf(page, 0);
    await expect.poll(() => slideOf(page, 0), { timeout: SLIDE_WAIT }).not.toBe(start);
    const moved = await slideOf(page, 0);
    await expect.poll(() => slideOf(page, 0), { timeout: SLIDE_WAIT }).not.toBe(moved);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const parked = await slideOf(page, 0);
    await page.waitForTimeout(5_000);
    expect(await slideOf(page, 0), "a card that is off screen does not move").toBe(parked);

    await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(2, 2);
    await card.hover();
    const next = card.getByRole("button", { name: "Next photo" });
    const before = await slideOf(page, 0);
    await next.click();
    const after = await slideOf(page, 0);
    expect(after).not.toBe(before);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(4_500);
    expect(await slideOf(page, 0), "no auto move for 6 s after a click").toBe(after);
    await expect.poll(() => slideOf(page, 0), { timeout: SLIDE_WAIT }).not.toBe(after);
  });

  test("with reduced motion nothing moves by itself", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openHome(page);
    await page.locator(CARD).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    const start = await slideOf(page, 0);
    await page.waitForTimeout(6_000);
    expect(await slideOf(page, 0)).toBe(start);
    await context.close();
  });

  test("a video plays first, muted, then the photos follow; on a phone only one video plays at a time", async ({ page, browser, baseURL }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const slugs = (await page.locator(`${CARD} .tkh-ad-title a`).evaluateAll((links) => links.slice(0, 3).map((link) => link.getAttribute("href") ?? ""))).map((href) => href.replace(/^\/ad\//, "").replace(/\/$/, ""));
    const cleanup = await addVideos(page, slugs);
    try {
      await page.waitForTimeout(61_000);
      const card = page.locator(CARD).first();
      await expect(async () => {
        await page.goto("/");
        await expect(card.locator('[data-tk="card-video"]')).toHaveCount(1, { timeout: 2_000 });
      }).toPass({ timeout: 40_000, intervals: [3_000] });
      await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.mouse.move(2, 2);
      const video = card.locator('[data-tk="card-video"]');
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused), { timeout: SLIDE_WAIT }).toBe(true);
      expect(await video.evaluate((el: HTMLVideoElement) => el.muted)).toBe(true);
      await expect.poll(() => slideOf(page, 0), { timeout: 20_000 }).toBeGreaterThan(0);
      expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);

      const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const view = await phone.newPage();
      await view.goto("/");
      await view.locator('[data-tk="ads-row"]').scrollIntoViewIfNeeded();
      let most = 0;
      for (let tick = 0; tick < 12; tick += 1) {
        await view.waitForTimeout(700);
        most = Math.max(most, await view.evaluate(() => [...document.querySelectorAll<HTMLVideoElement>('[data-tk="card-video"]')].filter((el) => !el.paused).length));
      }
      expect(most).toBeLessThanOrEqual(1);
      await phone.close();
    } finally {
      await cleanup();
    }
  });
});
