import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, isPhone, slugFromAdPath, test, uploadsDir, withLocalDb } from "./helpers";

const SHOTS = process.env.GALLERY_SHOTS_DIR || "";

async function datingAdAt(page: Page, position: number) {
  await page.goto("/dating/bengaluru/");
  const link = page.locator(':is([data-tk=card], [data-tk=home-ad], [data-tk=listing-row]) a[data-ad-link]').nth(position);
  await link.waitFor({ state: "attached" });
  return (await link.getAttribute("href")) as string;
}

async function makeClip(page: Page) {
  await page.goto("/");
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(25);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((done) => (recorder.onstop = () => done()));
    recorder.start();
    let tick = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(tick * 12) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 320, 200);
      ctx.fillStyle = "#fff";
      ctx.fillRect((tick * 9) % 280, 80, 40, 40);
      tick += 1;
    }, 40);
    await new Promise((done) => setTimeout(done, 2500));
    clearInterval(timer);
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  return Buffer.from(base64, "base64");
}

async function playing(page: Page) {
  return page.locator("[data-tk=gallery-video] video").evaluate((node: HTMLVideoElement) => !node.paused && !node.ended && node.readyState >= 2);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.describe("H7.99 ad gallery", () => {
  test("arrows are always visible, the counter moves, keys and the full-screen viewer work, and the page stays clean", async ({ page }) => {
    const href = await datingAdAt(page, 0);
    await page.goto(href);
    const gallery = page.locator('[data-tk="gallery"]');
    await expect(gallery).toBeVisible();
    const figure = gallery.locator("figure.tkn-gal");
    const box = (await figure.boundingBox())!;
    const ratio = box.width / box.height;
    if (isPhone(page)) expect(ratio).toBeCloseTo(4 / 3, 1);
    else expect(ratio).toBeGreaterThan(1.5);
    expect(box.height).toBeLessThanOrEqual(501);

    const counter = gallery.locator('[data-tk="gallery-counter"]');
    const first = ((await counter.innerText()) || "").trim();
    const total = Number(first.split("/")[1]);
    expect(total).toBeGreaterThan(1);
    expect(first).toBe(`1 / ${total}`);
    for (const name of ["gallery-prev", "gallery-next"]) {
      const arrow = gallery.locator(`[data-tk="${name}"]`);
      await expect(arrow).toBeVisible();
      const size = (await arrow.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }
    await gallery.locator('[data-tk="gallery-next"]').click();
    await expect(counter).toHaveText(`2 / ${total}`);
    await gallery.locator('[data-tk="gallery-prev"]').click();
    await gallery.locator('[data-tk="gallery-prev"]').click();
    await expect(counter).toHaveText(`${total} / ${total}`);
    await gallery.locator('[data-tk="gallery-next"]').click();
    await expect(counter).toHaveText(`1 / ${total}`);

    await figure.focus();
    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText(`2 / ${total}`);
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText(`1 / ${total}`);

    const thumbs = gallery.locator('[data-tk="gallery-thumbs"] button');
    await expect(thumbs).toHaveCount(total);
    await thumbs.nth(2).click();
    await expect(counter).toHaveText(`3 / ${total}`);
    await expect(thumbs.nth(2)).toHaveAttribute("aria-pressed", "true");
    await thumbs.nth(0).click();

    await shot(page, `gallery-${isPhone(page) ? "phone" : "desktop"}`);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include('[data-tk="gallery"]').analyze();
    expect(axe.violations.map((item) => item.id)).toEqual([]);

    await gallery.locator('[data-tk="gallery-expand"]').click();
    const viewer = page.locator('[data-tk="gallery-viewer"]');
    await expect(viewer).toBeVisible();
    const stage = (await viewer.locator("img").boundingBox())!;
    expect(stage.width).toBeGreaterThan(200);
    await page.keyboard.press("ArrowRight");
    await expect(viewer).toContainText(`2 / ${total}`);
    await viewer.getByRole("button", { name: "Next photo" }).click();
    await expect(viewer).toContainText(`3 / ${total}`);
    const viewerAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include('[data-tk="gallery-viewer"]').analyze();
    expect(viewerAxe.violations.map((item) => item.id)).toEqual([]);
    await shot(page, `viewer-${isPhone(page) ? "phone" : "desktop"}`);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(counter).toHaveText(`3 / ${total}`);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("a video comes first, plays on its own when in view, pauses when off screen and respects reduced motion", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the clip is built once, on the wide screen");
    const wanted = slugFromAdPath(await datingAdAt(page, 6));
    const clip = await makeClip(page);
    expect(clip.length).toBeGreaterThan(1000);
    const name = `${randomBytes(12).toString("hex")}.webm`;
    mkdirSync(uploadsDir(), { recursive: true });
    const file = resolve(uploadsDir(), name);
    const assetId = new ObjectId();
    let slug = "";
    try {
      const seeded = await withLocalDb(async (db) => {
        const row = await db.collection("listings").findOne({ slug: wanted });
        if (!row) return null;
        await db.collection("media_assets").insertOne({
          _id: assetId,
          ownerId: row.ownerId,
          listingId: row._id,
          kind: "video",
          objectKey: `/uploads/${name}`,
          contentType: "video/webm",
          status: "cleared",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return row.slug as string;
      });
      expect(seeded, "a dating ad and the test database are needed").toBeTruthy();
      slug = seeded as string;
      writeFileSync(file, clip);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/ad/${slug}/`);
      const gallery = page.locator('[data-tk="gallery"]');
      const video = gallery.locator("[data-tk=gallery-video] video");
      await expect(video).toBeVisible();
      await expect(video).toHaveJSProperty("muted", true);
      await expect.poll(() => playing(page), { timeout: 15_000 }).toBe(true);
      await shot(page, "video-playing-desktop");

      await gallery.locator('[data-tk="gallery-play"]').click();
      await expect.poll(() => playing(page)).toBe(false);
      await gallery.locator('[data-tk="gallery-play"]').click();
      await expect.poll(() => playing(page)).toBe(true);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => playing(page), { timeout: 10_000 }).toBe(false);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => playing(page), { timeout: 10_000 }).toBe(true);

      await gallery.locator('[data-tk="gallery-next"]').click();
      await expect(gallery.locator("[data-tk=gallery-video]")).toHaveCount(0);
      await gallery.locator('[data-tk="gallery-thumbs"] button').first().click();
      await expect(gallery.locator("[data-tk=gallery-video]")).toBeVisible();

      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include('[data-tk="gallery"]').analyze();
      expect(axe.violations.map((item) => item.id)).toEqual([]);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/ad/${slug}/`);
      await expect(gallery.locator("[data-tk=gallery-video] video")).toBeVisible();
      await page.waitForTimeout(1500);
      expect(await playing(page)).toBe(false);
      await gallery.locator('[data-tk="gallery-play"]').click();
      await expect.poll(() => playing(page)).toBe(true);
    } finally {
      rmSync(file, { force: true });
      await withLocalDb((db) => db.collection("media_assets").deleteOne({ _id: assetId }));
    }
  });

  test("at the required laptop sizes the whole picture and both arrows are in the window, with no sideways scroll", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the laptop sizes are checked once");
    const href = await datingAdAt(page, 0);
    for (const [width, height] of [
      [1366, 768],
      [1536, 730],
      [1536, 674],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(href);
      const figure = page.locator("[data-tk=gallery] figure.tkn-gal");
      await expect(figure).toBeVisible();
      const box = (await figure.boundingBox())!;
      expect(box.y + box.height, `${width}x${height}`).toBeLessThanOrEqual(height);
      const next = (await page.locator("[data-tk=gallery-next]").boundingBox())!;
      expect(next.x + next.width).toBeLessThanOrEqual(width);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, `ad-${width}x${height}`);
    }
    for (const [width, height] of [
      [390, 844],
      [360, 740],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(href);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, `ad-${width}x${height}`);
    }
  });
});
