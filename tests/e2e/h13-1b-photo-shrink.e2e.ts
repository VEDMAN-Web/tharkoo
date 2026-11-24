import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { ADMIN_EMAIL, expect, hasHorizontalScroll, loginUi, newUserApi, originHeaders, signInAdminContext, test, USER_PASSWORD, withLocalDb } from "./helpers";

/** H13.1 part 2: a photo of any size is made smaller in the browser before it is sent, and a file that is not a picture says so in plain words. */

const SHOTS = process.env.H131_SHOTS_DIR ?? "";
const MB = 1024 * 1024;
const UNREADABLE = "This photo could not be read. Try another photo or take a screenshot of it.";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

/** Chooses a REAL picture made in the page: 6000 x 4000 of noise, about 20 MB as a JPEG. Returns its size in bytes. */
async function chooseBigJpeg(page: Page, inputSelector: string): Promise<number> {
  return page.evaluate(async (selector) => {
    const canvas = document.createElement("canvas");
    canvas.width = 6000;
    canvas.height = 4000;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(6000, 4000);
    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = Math.random() * 255;
      image.data[index + 1] = Math.random() * 255;
      image.data[index + 2] = Math.random() * 255;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value!), "image/jpeg", 1));
    const file = new File([blob], "holiday-6000x4000.jpg", { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return file.size;
  }, inputSelector);
}

async function chooseBrokenFile(page: Page, inputSelector: string) {
  await page.evaluate((selector) => {
    const file = new File([new Uint8Array(200_000).map((_, index) => index % 251)], "broken.jpg", { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, inputSelector);
}

test.describe("H13.1 part 2: any photo size", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("A5b: a 20 MB JPG on Create ad is made smaller before it is sent (the server is asked to sign a file under 8 MB), uploads without an error and shows its preview", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const mediaId = new ObjectId().toHexString();
    const admin = await withLocalDb((db) => db.collection("users").findOne({ email: ADMIN_EMAIL }, { projection: { _id: 1 } }));
    await withLocalDb((db) =>
      db.collection("media_assets").insertOne({ _id: new ObjectId(mediaId), ownerId: admin!._id, kind: "image", objectKey: `/uploads/${mediaId}.jpg`, status: "cleared", clearedAt: new Date(), contentType: "image/jpeg", bytes: 3 * MB, createdAt: new Date(), updatedAt: new Date() }),
    );
    const signed: Record<string, unknown>[] = [];
    await page.route("**/api/media/staff-sign", async (route) => {
      signed.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { mode: "cloudinary", mediaId, uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload", apiKey: "k", timestamp: 1, signature: "s", folder: "tharkoo/listings", params: { public_id: mediaId } } }),
      });
    });
    await page.route("https://api.cloudinary.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
    await page.route("**/api/media/staff-complete", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { mediaId, kind: "image", name: "holiday-6000x4000.jpg" } }) }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/ads/create/");
    await page.getByLabel("Category *").selectOption({ index: 1 });
    const original = await chooseBigJpeg(page, "section[aria-labelledby='ad-photos-h'] input[type=file]");
    expect(original).toBeGreaterThan(12 * MB);
    const photos = page.locator("section[aria-labelledby='ad-photos-h']");
    await expect(photos.locator("[data-state=ready]")).toHaveCount(1, { timeout: 120_000 });
    await expect(photos.locator("li", { hasText: "holiday-6000x4000.jpg" }).locator("img")).toBeVisible();
    expect(await photos.innerText()).not.toMatch(/too big|limit is 8 MB|Connection problem/i);
    expect(signed).toHaveLength(1);
    expect(Number(signed[0].byteSize)).toBeLessThanOrEqual(8 * MB);
    expect(Number(signed[0].byteSize)).toBeLessThan(original);
    await shot(page, "create-ad-photo-20mb-ready");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "create-ad-photo-20mb-ready");
  });

  test("A5b: a 20 MB JPG on the seller post-ad photo step uploads with no error, shows its preview and is saved as a smaller picture", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const { email } = await newUserApi(baseURL!, "shrinkseller");
    await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
    const saved = await page.request.put("/api/auth/seller-profile", {
      headers: originHeaders(baseURL!, "/u/seller-profile/"),
      data: { name: "E2E Poster", city: "Mumbai", whatsapp: "", availableNow: false },
    });
    expect(saved.status(), await saved.text()).toBe(200);
    await page.goto("/u/post-insert/");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(".tkp-tile", { hasText: "Jobs" }).click();
    await page.locator("[data-tk=go-on]").click();
    if (await page.locator("#state").count()) await page.locator("#state").selectOption({ label: "Maharashtra" });
    await page.locator("#city").selectOption({ label: "Mumbai" });
    await page.locator("#nickname").fill("Asha");
    const roleHere = (await page.locator("#role").count()) > 0;
    if (roleHere) await page.locator("#role").fill("Office assistant");
    await page.locator("#title").fill(`Shrink ${Date.now()}`);
    await page.locator("#text").fill("A weekday office role with a clear description of the work and the hours.");
    await page.locator("[data-tk=go-on]").click();
    if (!roleHere) {
      await page.locator("#role").fill("Office assistant");
      await page.locator("[data-tk=go-on]").click();
    }
    await page.locator("[data-tk=photo-input]").waitFor({ state: "attached" });
    const original = await chooseBigJpeg(page, "[data-tk=photo-input]");
    expect(original).toBeGreaterThan(12 * MB);
    await expect(page.locator("[data-tk=photo-note]")).toContainText(/Photo saved/i, { timeout: 180_000 });
    await expect(page.locator('[data-tk=photo-tile][data-state="failed"]')).toHaveCount(0);
    await expect(page.locator("[data-tk=photo-tile] img").first()).toBeVisible();
    const row = await withLocalDb((db) => db.collection("media_assets").find({ kind: "image" }).sort({ createdAt: -1 }).limit(1).toArray());
    const bytes = Number(row?.[0]?.bytes ?? 0);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(8 * MB);
    await shot(page, "post-photo-20mb-ready");
  });

  test("A5c: a broken image file shows the could-not-be-read line on Create ad", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/ads/create/");
    await page.getByLabel("Category *").selectOption({ index: 1 });
    const photos = page.locator("section[aria-labelledby='ad-photos-h']");
    await chooseBrokenFile(page, "section[aria-labelledby='ad-photos-h'] input[type=file]");
    await expect(photos.getByText(UNREADABLE)).toBeVisible({ timeout: 30_000 });
    await shot(page, "create-ad-photo-broken");
  });
});
