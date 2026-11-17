import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.57: the Media library upload box with previews, ticking several pictures to move to the Trash, and the list of pictures to describe. */

const SHOTS = process.env.H857_SHOTS_DIR ?? "";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

async function seed(tag: string, alts: string[], extra: Record<string, unknown> = {}) {
  const ids = await withLocalDb(async (db) => {
    const out: string[] = [];
    for (const alt of alts) {
      const id = new ObjectId();
      await db.collection("site_media").insertOne({ _id: id, url: "/brand/logo-mark.svg", objectKey: `site/h857-${tag}-${id.toHexString()}.png`, alt, width: 640, height: 480, bytes: 120_000, contentType: "image/png", tags: [tag], uploadedBy: "h857@example.test", altAuto: false, trashedAt: null, purgeAfter: null, focusX: 50, focusY: 50, createdAt: new Date(), ...extra });
      out.push(id.toHexString());
    }
    return out;
  });
  expect(ids).not.toBeNull();
  return ids!;
}

test.describe("H8.57 Media library", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("the upload box shows a picture of every chosen file, says why a file is refused, and a file can be taken off the list (at 1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/media/");
      await page.getByRole("button", { name: "Upload pictures" }).click();
      const box = page.locator('[data-tk="upload-box"]');
      await expect(box).toBeVisible();
      await expect(page.locator('[data-tk="upload-drop"]')).toContainText("Drop pictures here, or choose them");
      await page.getByLabel("Choose pictures to upload").setInputFiles([
        { name: "kitchen.png", mimeType: "image/png", buffer: PNG },
        { name: "balcony.png", mimeType: "image/png", buffer: PNG },
        { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
      ]);
      const rows = page.locator('[data-tk="upload-row"]');
      await expect(rows).toHaveCount(3);
      await expect(rows.locator("img")).toHaveCount(2);
      await expect(rows.nth(2)).toContainText("Only jpeg, png or webp images");
      await expect(box.getByRole("button", { name: "Upload 2 pictures" })).toBeEnabled();
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "upload-previews");
      await page.getByRole("button", { name: "Take balcony.png off the list" }).click();
      await expect(rows).toHaveCount(2);
      await expect(box.getByRole("button", { name: "Upload 1 picture" })).toBeEnabled();
    }
  });

  test("tick several pictures, move them to the Trash together (one in use stays), and Undo puts them back", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const tag = `h857b${Date.now() % 100000}`;
    const [a, b, c, used] = await seed(tag, [`${tag} kitchen`, `${tag} balcony`, `${tag} garden`, `${tag} dating card`]);
    await withLocalDb((db) => db.collection("categories").updateOne({ slug: "dating" }, { $set: { photo: { mediaId: new ObjectId(used), focusX: 50, focusY: 50, alt: "Dating card" } } }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/media/?q=${tag}`);
    const ticks = page.locator('[data-tk="media-tick"]');
    await expect(ticks).toHaveCount(4);
    await expect(page.locator('[data-tk="bulk-bar"]')).toHaveCount(0);
    await ticks.nth(0).check();
    await ticks.nth(1).check();
    await expect(page.locator('[data-tk="bulk-bar"]')).toContainText("2 selected");
    await page.getByRole("button", { name: "Select all on this page" }).click();
    await expect(page.locator('[data-tk="bulk-bar"]')).toContainText("4 selected");
    await shot(page, "bulk-bar");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator('[data-tk="bulk-bar"]')).toHaveCount(0);

    await ticks.nth(0).check();
    await ticks.nth(1).check();
    await ticks.nth(2).check();
    await ticks.nth(3).check();
    await page.locator('[data-tk="bulk-bar"]').getByRole("button", { name: "Move to Trash" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Move 4 pictures to the Trash?");
    await dialog.getByRole("button", { name: "Move to Trash" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Moved 3 pictures to the Trash. 1 is still used on the site and stayed.");
    const state = async () => (await withLocalDb((db) => db.collection("site_media").find({ _id: { $in: [a, b, c, used].map((id) => new ObjectId(id)) } }).project({ trashedAt: 1 }).toArray()))?.map((row) => Boolean(row.trashedAt)) ?? [];
    await expect.poll(async () => (await state()).filter(Boolean).length).toBe(3);
    await page.locator('[data-tk="toast"]').getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await state()).filter(Boolean).length).toBe(0);
    await withLocalDb((db) => db.collection("categories").updateOne({ slug: "dating" }, { $unset: { photo: "" } }));
  });

  test("Missing alt is a to-do list: nothing is filled in, a short text is refused, a real one is saved and the picture leaves the list (at 1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const tag = `h857m${Date.now() % 100000}`;
    const [auto] = await seed(tag, [`${tag}-sunset-beach`], { altAuto: true });
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`/admin/media/?tab=missing&q=${tag}`);
      const row = page.locator('[data-tk="describe-row"]');
      await expect(row).toHaveCount(1);
      await expect(row.getByLabel("Describe the picture")).toHaveValue("");
      await expect(row).toContainText("Only the file name so far");
      await expect(page.locator('[data-tk="describe-list"]')).toContainText("Nothing is filled in for you");
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "describe-todo");
    }
    const row = page.locator('[data-tk="describe-row"]');
    await row.getByLabel("Describe the picture").fill("ab");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByRole("alert")).toContainText("Describe the picture in a few words.");
    await row.getByLabel("Describe the picture").fill("A beach at sunset with palm trees");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Description saved.");
    await expect.poll(async () => (await withLocalDb((db) => db.collection("site_media").findOne({ _id: new ObjectId(auto) }, { projection: { alt: 1, altAuto: 1 } })))?.alt).toBe("A beach at sunset with palm trees");
    expect((await withLocalDb((db) => db.collection("site_media").findOne({ _id: new ObjectId(auto) }, { projection: { altAuto: 1 } })))?.altAuto).toBe(false);
    await expect(page.locator('[data-tk="describe-row"]')).toHaveCount(0);
  });
});
