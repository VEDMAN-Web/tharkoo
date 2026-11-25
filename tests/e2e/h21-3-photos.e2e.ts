import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, loginUi, newUserApi, originHeaders, PNG, test, USER_PASSWORD } from "./helpers";

/**
 * H21.3: Step 3, Photos. The empty drop box, the 3-column (phone: 2) grid of 4:5 tiles with a row of icon buttons under each, the cover badge,
 * drag to reorder, the uploading and failed tiles, the guidelines panel and the preview that outlines the photo.
 * Set SHOTS_DIR to save screenshots (390, 768, 1440).
 */
const shotsDir = process.env.SHOTS_DIR;
async function shot(page: Page, name: string, viewportOnly = false) {
  if (!shotsDir) return;
  mkdirSync(shotsDir, { recursive: true });
  const width = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: `${shotsDir}/${name}-${width}.png`, fullPage: !viewportOnly });
  if (width === 390) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: `${shotsDir}/${name}-768.png`, fullPage: !viewportOnly });
    await page.setViewportSize({ width: 390, height: 844 });
  }
}

async function openPhotos(page: Page, baseURL: string) {
  const owner = await newUserApi(baseURL, "h213");
  const categories = (await (await owner.api.get("/api/categories")).json()).data.categories as { _id: string; slug: string }[];
  const cities = (await (await owner.api.get("/api/locations?type=city")).json()).data.locations as { id: string; name: string }[];
  const category = categories.find((item) => item.slug === "buy-and-sell") ?? categories[0];
  const city = cities.find((item) => item.name === "Mumbai") ?? cities[0];
  const created = await owner.api.post("/api/listings", {
    headers: originHeaders(baseURL, "/u/post-insert/"),
    data: { categoryId: category._id, cityId: city.id, title: `Photos check ${Date.now()}`, description: "A friendly description of the ad that is long enough." },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()).data as { id: string }).id;
  await loginUi(page, owner.email, USER_PASSWORD, `/u/post-insert/?draft=${id}&step=photos`);
  await page.waitForURL(/step=photos/);
  await expect(page.locator("[data-tk=photo-step]")).toBeVisible();
  return owner;
}

/** A few distinct PNGs (the byte after the signature changes nothing a viewer sees but makes each file different). */
function pngs(count: number) {
  return Array.from({ length: count }, (_, index) => ({ name: `p${index}.png`, mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([index])]) }));
}

test.describe("H21.3 step 3 photos", () => {
  test("empty state, guidelines and the preview that outlines the photo", async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const phone = info.project.name === "phone-390";
    await openPhotos(page, baseURL!);
    await expect(page.locator("[data-tk=step-title]")).toHaveText("Photos");
    await expect(page.locator("[data-tk=step-help]")).toHaveText("The first photo is your cover.");
    const drop = page.locator("[data-tk=photo-drop]");
    await expect(drop).toBeVisible();
    await expect(drop).toContainText("Add photos of your work or place");
    await expect(drop.getByText("Choose photos")).toBeVisible();
    await expect(drop.getByText("Take a photo")).toBeVisible();
    await expect(drop.getByText("Add video")).toBeVisible();
    await expect(page.locator("[data-tk=photo-tip]")).toContainText("3 or more photos");
    await expect(page.locator("[data-tk=go-on]")).toHaveText("Skip for now");
    // Guidelines: the side column on a computer, under the box on a phone. The numbers come from the upload rules.
    const guide = page.locator(phone ? "[data-tk=photo-guidelines-inline]" : "[data-tk=photo-guidelines-side]");
    await expect(guide).toBeVisible();
    await expect(page.locator(phone ? "[data-tk=photo-guidelines-side]" : "[data-tk=photo-guidelines-inline]")).toBeHidden();
    await expect(guide).toContainText("Videos: up to 60 seconds and 100 MB.");
    await expect(guide).toContainText("Up to 10 photos and videos in total.");
    await expect(guide).toContainText("Photos that break these rules are removed");
    if (!phone) await expect(page.locator("[data-tk=preview-photo]")).toHaveClass(/hl/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await shot(page, "photos-empty");
    await shot(page, "photos-guidelines", true);
  });

  test("grid, cover, buttons under each photo, drag to reorder, failed and uploading tiles", async ({ page, baseURL }, info) => {
    test.setTimeout(240_000);
    const phone = info.project.name === "phone-390";
    await openPhotos(page, baseURL!);
    await page.locator("[data-tk=photo-input]").setInputFiles(pngs(3));
    const tiles = page.locator("[data-tk=photo-grid] [data-tk=photo-tile][data-state=live]");
    await expect(tiles).toHaveCount(3, { timeout: 60_000 });
    await expect(page.locator("[data-tk=photo-count]")).toHaveText("3 of 10 added");
    await expect(page.locator("[data-tk=go-on]")).toHaveText("Continue");

    // Two columns on a phone, three on a computer; 4:5 tiles; the first photo is the cover.
    const boxes = await page.locator("[data-tk=photo-grid] .tkph-img").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { top: Math.round(r.top), width: r.width, height: r.height }; }));
    const perRow = boxes.filter((box) => box.top === boxes[0].top).length;
    expect(perRow).toBe(phone ? 2 : 3);
    expect(Math.abs(boxes[0].height - boxes[0].width * 1.25)).toBeLessThan(2);
    await expect(tiles.nth(0).locator("[data-tk=photo-cover]")).toHaveCount(1);
    await expect(tiles.nth(1).locator("[data-tk=photo-cover]")).toHaveCount(0);
    // One row of 44 px icon buttons under each photo: make cover (not on the cover), arrows, bin.
    await expect(tiles.nth(0).locator("[data-tk=make-cover]")).toHaveCount(0);
    await expect(tiles.nth(1).locator("[data-tk=make-cover]")).toHaveCount(1);
    const buttons = await tiles.nth(1).locator(".tkph-actions button").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), label: node.getAttribute("aria-label"), title: node.getAttribute("title") }; }));
    expect(buttons.length).toBe(4);
    expect(new Set(buttons.map((button) => button.top)).size).toBe(1);
    for (const button of buttons) {
      expect(button.h).toBeGreaterThanOrEqual(44);
      // Four buttons never fit in a two-column phone tile at 44 px each, so they share the row (never narrower than 36 px).
      expect(button.w).toBeGreaterThanOrEqual(36);
      expect(button.label).toBeTruthy();
      expect(button.title).toBeTruthy();
    }
    // Only the page scrolls.
    const inner = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".tkp-post *")).filter((node) => { const s = getComputedStyle(node); return s.display !== "none" && (s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight - node.clientHeight > 1; }).length);
    expect(inner).toBe(0);
    await shot(page, "photos-grid");

    // Drag the first photo to the third place with the mouse: the order changes and the new first photo is the cover.
    if (!phone) {
      const before = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-id")));
      const first = (await page.locator("[data-tk=photo-grid] .tkph-img").nth(0).boundingBox())!;
      const third = (await page.locator("[data-tk=photo-grid] .tkph-img").nth(2).boundingBox())!;
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(first.x + first.width / 2 + 30, first.y + first.height / 2 + 10, { steps: 4 });
      await expect(page.locator('[data-tk=photo-tile][data-drag="lifted"]')).toHaveCount(1);
      await expect(page.locator('[data-tk=photo-slot]')).toHaveCount(1);
      await shot(page, "photos-dragging", true);
      await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect(page.locator('[data-tk=photo-tile][data-drag="lifted"]')).toHaveCount(0);
      await expect.poll(async () => tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-id"))), { timeout: 15_000 }).toEqual([before[1], before[2], before[0]]);
      await expect(tiles.nth(0).locator("[data-tk=photo-cover]")).toHaveCount(1);
    }
    // The arrow buttons do the same job without dragging.
    const ids = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-id")));
    await tiles.nth(0).getByRole("button", { name: /Move .* right/ }).click();
    await expect.poll(async () => tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-id"))), { timeout: 15_000 }).toEqual([ids[1], ids[0], ids[2]]);

    // A file that is not a photo gives a failed tile with the reason, a bin, and no Try again (nothing was sent).
    await page.locator("[data-tk=photo-input]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    const failed = page.locator('[data-tk=photo-grid] [data-tk=photo-tile][data-state="failed"]');
    await expect(failed).toHaveCount(1);
    await expect(failed.locator("[data-tk=upload-failed]")).toContainText("Could not upload");
    await expect(failed.locator("[data-tk=media-reason]")).toBeVisible();
    await expect(failed.getByRole("button", { name: /Remove/ })).toBeVisible();
    await shot(page, "photos-failed");
    await failed.getByRole("button", { name: /Remove/ }).click();
    await expect(failed).toHaveCount(0);

    // An upload in progress: the photo shows with "Uploading N%" and a bar.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/media/local", async (route) => { await held; await route.continue(); });
    await page.locator("[data-tk=photo-input]").setInputFiles(pngs(1));
    const uploading = page.locator('[data-tk=photo-grid] [data-tk=photo-tile][data-state="uploading"]');
    await expect(uploading).toHaveCount(1);
    await expect(uploading.locator("[data-tk=upload-progress]")).toContainText(/Uploading \d+%/);
    await shot(page, "photos-uploading");
    // The support bubble stays visible on this step.
    await expect(page.locator(".tkn-chat-bubble")).toBeVisible();
    await shot(page, "photos-bubble", true);
    release();
    await expect(page.locator("[data-tk=photo-count]")).toHaveText("4 of 10 added", { timeout: 60_000 });
  });
});
