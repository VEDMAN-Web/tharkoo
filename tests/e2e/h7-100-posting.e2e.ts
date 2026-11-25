import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, PNG, test, USER_PASSWORD, withLocalDb, pickCity } from "./helpers";

const SHOTS = join("D:/Skokka/Final Tharkoo/.relay/shots", "H7.100");
const MB = 1024 * 1024;

function mp4(seconds: number, pad = 0) {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom0000isom")), box("mdat", Buffer.alloc(pad)), box("moov", box("mvhd", mvhd))]);
}

async function startAd(page: Page, baseURL: string, prefix: string) {
  const { api, email } = await newUserApi(baseURL, prefix);
  await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
  const saved = await page.request.put("/api/auth/seller-profile", {
    headers: originHeaders(baseURL, "/u/seller-profile/"),
    data: { name: "E2E Poster", city: "Mumbai", whatsapp: "", availableNow: false },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  await page.goto("/u/post-insert/");
  await expect(page.locator(".tkp-tile").first()).toBeVisible();
  return api;
}

async function toPhotos(page: Page, title: string) {
  await page.locator(".tkp-tile", { hasText: "Dating" }).click();
  await page.locator("[data-tk=go-on]").click();
  await pickCity(page, "Mumbai");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("Looking to meet for coffee and a walk, in a public place, on weekends.");
  await page.getByText("Coffee", { exact: true }).first().click();
  await page.locator("[data-tk=go-on]").click();
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
}

/**
 * FIX-1: a listing about people (Dating) never holds a video, so the video rules are walked on a Jobs ad (an ordinary category).
 * The same steps as the Dating draft above: category, details (with the role), then the photos step.
 */
async function toPhotosJobs(page: Page, title: string) {
  await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
  await page.locator("[data-tk=go-on]").click();
  await pickCity(page, "Mumbai");
  const roleHere = (await page.locator("#role").count()) > 0;
  if (roleHere) await page.locator("#role").fill("Office assistant");
  await page.locator("#title").fill(title);
  await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
  await page.locator("[data-tk=go-on]").click();
  if (!roleHere) {
    await page.locator("#role").fill("Office assistant");
    await page.locator("[data-tk=go-on]").click();
  }
  await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
}

test.describe("H7.100: posting works end to end", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own viewports");
    const off = await withLocalDb((db) => db.collection("watermark_settings").updateOne({ key: "default" }, { $set: { enabled: false } }, { upsert: true }));
    expect(off, "E2E_MONGO_URI_FILE must point at the in-memory database").toBeTruthy();
  });

  test("a refused photo or video keeps its tile with a red line that says why", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    mkdirSync(SHOTS, { recursive: true });
    const api = await startAd(page, baseURL!, "tiles");
    await toPhotosJobs(page, `Tiles ${Date.now()}`);

    // H13.1 part 2: a photo of any size is accepted. This 9 MB file is not a picture (all zeros), so it is refused as unreadable, never as too big.
    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(9 * MB) });
    await expect(page.locator('[data-tk=photo-tile][data-state="failed"] [data-tk=media-reason]')).toHaveText("This photo could not be read. Try another photo or take a screenshot of it.");
    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "pic.gif", mimeType: "image/gif", buffer: PNG });
    await expect(page.locator('[data-tk=photo-tile][data-state="failed"] [data-tk=media-reason]').last()).toHaveText("Use a JPG, PNG or WebP photo.");

    const bigFile = join(tmpdir(), `tharkoo-big-${Date.now()}.mp4`);
    writeFileSync(bigFile, Buffer.alloc(120 * MB));
    try {
      await page.locator("[data-tk=video-input]").setInputFiles(bigFile);
    } finally {
      rmSync(bigFile, { force: true });
    }
    const bigVideo = page.locator('[data-tk=video-grid] [data-tk=photo-tile][data-state="failed"]').first();
    await expect(bigVideo.locator("[data-tk=media-reason]")).toHaveText("This file is too big (max 100 MB).");
    await expect(bigVideo).toBeVisible();

    await page.locator("[data-tk=video-input]").setInputFiles({ name: "long.mp4", mimeType: "video/mp4", buffer: mp4(75) });
    await expect(page.locator('[data-tk=video-grid] [data-tk=media-reason]').last()).toHaveText("This video is longer than 60 seconds.");
    expect(await page.locator('[data-tk=video-grid] [data-tk=photo-tile][data-state="failed"]').count()).toBe(2);

    const reasonColor = await bigVideo.locator("[data-tk=media-reason]").evaluate((node) => getComputedStyle(node).color);
    expect(reasonColor).toBe("rgb(159, 18, 57)");
    await page.screenshot({ path: join(SHOTS, "tiles-refused-1440x900.png") });
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.screenshot({ path: join(SHOTS, "tiles-refused-1536x674.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(SHOTS, "tiles-refused-390x844.png") });
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.locator('[data-tk=photo-tile][data-state="failed"]').first().getByRole("button", { name: /Remove/ }).click();
    await expect(page.locator('[data-tk=photo-grid] [data-tk=photo-tile][data-state="failed"]')).toHaveCount(1);
    await api.dispose();
  });

  test("a video of 45 seconds uploads, and a dropped connection keeps the tile with Tap to retry", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const api = await startAd(page, baseURL!, "video");
    await toPhotosJobs(page, `Video ${Date.now()}`);

    let drops = 1;
    await page.route("**/api/media/local", async (route) => {
      if (drops > 0) {
        drops -= 1;
        await route.abort("connectionreset");
        return;
      }
      await route.continue();
    });
    await page.locator("[data-tk=video-input]").setInputFiles({ name: "walk.mp4", mimeType: "video/mp4", buffer: mp4(45, 6 * MB) });
    const tile = page.locator('[data-tk=video-grid] [data-tk=photo-tile]');
    await expect(tile.locator("[data-tk=media-reason]")).toHaveText("Upload failed, tap to retry.");
    await expect(tile.locator('[data-tk=retry-upload]')).toBeVisible();
    await tile.locator("[data-tk=retry-upload]").click();
    await expect(page.locator("[data-tk=photo-note]")).toHaveText("Video saved.", { timeout: 60_000 });
    await expect(page.locator('[data-tk=video-grid] [data-tk=photo-tile][data-state="live"]')).toHaveCount(1);
    await expect(page.locator('[data-tk=video-grid] [data-tk=photo-tile][data-state="failed"]')).toHaveCount(0);
    await api.dispose();
  });

  test("a full Jobs post with 3 photos and a video publishes and shows on its city page, with plain words if publishing is refused", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    mkdirSync(SHOTS, { recursive: true });
    const api = await startAd(page, baseURL!, "full");
    const title = `Office role ${Date.now()}`;
    await toPhotosJobs(page, title);
    await page.locator("[data-tk=photo-input]").setInputFiles(
      [1, 2, 3].map((index) => ({ name: `p${index}.png`, mimeType: "image/png", buffer: PNG })),
    );
    await expect(page.locator('[data-tk=photo-grid] [data-tk=photo-tile][data-state="live"]')).toHaveCount(3, { timeout: 60_000 });
    await page.locator("[data-tk=video-input]").setInputFiles({ name: "walk.mp4", mimeType: "video/mp4", buffer: mp4(20, 2 * MB) });
    await expect(page.locator('[data-tk=video-grid] [data-tk=photo-tile][data-state="live"]')).toHaveCount(1, { timeout: 60_000 });
    await expect(page.locator("[data-tk=photo-count]")).toContainText("4 of 10");
    await page.screenshot({ path: join(SHOTS, "photos-and-video-1440x900.png") });
    await page.setViewportSize({ width: 1536, height: 674 });
    await page.screenshot({ path: join(SHOTS, "photos-and-video-1536x674.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(SHOTS, "photos-and-video-390x844.png") });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.locator("[data-tk=go-on]").click();
    await page.locator("#phone").fill("9876543210");
    await page.locator("#nickname").fill("Asha"); // H21.4: asked in step 4
    await page.locator("[data-tk=go-on]").click();
    await page.locator("#consent-terms").check();
    await page.locator("#consent-adult").check();

    let refused = true;
    await page.route("**/api/listings/*/submit", async (route) => {
      if (refused) {
        refused = false;
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, data: null, error: { code: "POLICY_VIOLATION", message: "MEDIA_NOT_CLEARED" } }),
        });
        return;
      }
      await route.continue();
    });
    const publish = page.locator(".tkp-nav button", { hasText: /publish/i });
    await publish.click();
    const banner = page.locator(".tkp-banner").first();
    await expect(banner).toContainText("Your photos are still being checked. Try again in a minute.");
    await expect(banner).not.toContainText("MEDIA_NOT_CLEARED");
    await page.screenshot({ path: join(SHOTS, "publish-refused-1440x900.png") });

    await publish.click();
    await expect(page.locator("[data-tk=step-title]").filter({ hasText: /live/i })).toBeVisible({ timeout: 60_000 });

    const own = await page.request.get("/api/listings/?pageSize=100");
    const rows = ((await own.json()).data?.items || []) as { id: string; title: string; slug?: string; status?: string }[];
    const row = rows.find((item) => item.title.includes(title));
    expect(row?.status).toBe("active");
    await page.goto("/jobs/mumbai/");
    await expect(page.locator("a[data-ad-link]").filter({ hasText: title }).first()).toBeAttached({ timeout: 30_000 });
    await page.goto(`/ad/${row!.slug}/`);
    await expect(page.locator("h1")).toContainText(title);
    await page.screenshot({ path: join(SHOTS, "ad-live-1536x674.png") });
    await api.dispose();
  });
});
