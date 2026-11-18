import { mkdirSync } from "node:fs";
import type { Page, Request } from "@playwright/test";
import { ObjectId } from "mongodb";
import { ADMIN_EMAIL, expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/**
 * H13.1: staff photos go straight to Cloudinary with a signed request. The signing and completing calls and the Cloudinary call are all
 * answered here (nothing is ever sent to the real Cloudinary); the checks of the server side are in tests/server/media/h13-1-staff-upload.test.ts.
 */

const MB = 1024 * 1024;
const SHOTS = process.env.H131_SHOTS_DIR ?? "";
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6 * MB)]);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

/** Answers the three calls of a direct upload and records what the browser asked for. */
async function mockDirectUpload(page: Page, mediaId: string, complete: Record<string, unknown>) {
  const seen = { signs: [] as Record<string, unknown>[], cloudinary: 0, legacy: 0 };
  page.on("request", (request: Request) => {
    if (request.url().includes("/admin/ads/photos/") || request.url().includes("/admin/media/upload/")) seen.legacy += 1;
  });
  await page.route("**/api/media/staff-sign", async (route) => {
    seen.signs.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { mode: "cloudinary", mediaId, uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload", apiKey: "test-key", timestamp: 1, signature: "sig", folder: "tharkoo/listings", params: { public_id: mediaId } },
      }),
    });
  });
  await page.route("https://api.cloudinary.com/**", async (route) => {
    seen.cloudinary += 1;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ public_id: mediaId }) });
  });
  await page.route("**/api/media/staff-complete", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: complete }) });
  });
  return seen;
}

test.describe("H13.1 staff direct upload", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("A4: with no category chosen the hint line is visible and the picker is disabled; after choosing one the picker works (1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/ads/create/");
      const photos = page.locator("section[aria-labelledby='ad-photos-h']");
      await expect(photos.locator('[data-tk="photos-need-category"]')).toHaveText("Pick a category first, then add photos.");
      await expect(photos.locator("input[type=file]")).toBeDisabled();
      await shot(page, "create-ad-photos-no-category");
      await page.getByLabel("Category *").selectOption({ index: 1 });
      await expect(photos.locator('[data-tk="photos-need-category"]')).toHaveCount(0);
      await expect(photos.locator("input[type=file]")).toBeEnabled();
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "create-ad-photos-with-category");
    }
  });

  test("A3: a 6 MB photo on Create ad goes to Cloudinary without passing through our server, shows its preview and counts as ready", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const mediaId = new ObjectId().toHexString();
    const admin = await withLocalDb((db) => db.collection("users").findOne({ email: ADMIN_EMAIL }, { projection: { _id: 1 } }));
    await withLocalDb((db) => db.collection("media_assets").insertOne({ _id: new ObjectId(mediaId), ownerId: admin!._id, kind: "image", objectKey: `/uploads/${mediaId}.png`, status: "cleared", clearedAt: new Date(), contentType: "image/jpeg", bytes: 6 * MB, createdAt: new Date(), updatedAt: new Date() }));
    const seen = await mockDirectUpload(page, mediaId, { mediaId, kind: "image", name: "phone.jpg" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/ads/create/");
    const photos = page.locator("section[aria-labelledby='ad-photos-h']");
    await page.getByLabel("Category *").selectOption({ index: 1 });
    await photos.locator("input[type=file]").setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(photos.locator("[data-state=ready]")).toHaveCount(1, { timeout: 30_000 });
    await expect(photos.locator("li", { hasText: "phone.jpg" }).locator("img")).toBeVisible();
    expect(seen.signs).toHaveLength(1);
    expect(seen.signs[0]).toMatchObject({ purpose: "ad", kind: "image", contentType: "image/jpeg", byteSize: JPEG.length });
    expect(seen.cloudinary).toBe(1);
    expect(seen.legacy).toBe(0);
    await shot(page, "create-ad-photo-6mb-ready");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "create-ad-photo-6mb-ready");
  });

  test("A3: the Media library takes a 6 MB image the same way", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    const mediaId = new ObjectId().toHexString();
    const seen = await mockDirectUpload(page, mediaId, { id: mediaId, url: "/uploads/x.png", alt: "Phone", width: 4000, height: 3000, bytes: 6 * MB });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/media/?tab=upload");
    const input = page.getByLabel("Choose pictures to upload");
    await input.setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: JPEG });
    const send = page.getByRole("button", { name: /^Upload/ }).first();
    await send.click();
    await expect(page.getByText("Done").first()).toBeVisible({ timeout: 30_000 });
    expect(seen.signs[0]).toMatchObject({ purpose: "library", kind: "image", byteSize: JPEG.length });
    expect(seen.cloudinary).toBe(1);
    expect(seen.legacy).toBe(0);
    await shot(page, "media-library-6mb");
  });

  test("a refusal that is not ours (a host error page) says the file could not be uploaded, never Connection problem", async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signInAdminContext(context, baseURL!);
    await page.route("**/api/media/staff-sign", (route) => route.fulfill({ status: 413, contentType: "text/html", body: "<html>FUNCTION_PAYLOAD_TOO_LARGE</html>" }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/ads/create/");
    const photos = page.locator("section[aria-labelledby='ad-photos-h']");
    await page.getByLabel("Category *").selectOption({ index: 1 });
    await photos.locator("input[type=file]").setInputFiles({ name: "phone.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(photos.getByText("This file could not be uploaded (too big or a network problem). Try a smaller photo.")).toBeVisible({ timeout: 30_000 });
    expect(await photos.innerText()).not.toContain("Connection problem");
  });
});
