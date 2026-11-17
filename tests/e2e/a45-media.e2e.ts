import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.45 (A45): the Media library screen. */

const SHOTS = process.env.A45_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({});
    const make = async (alt: string) => {
      const id = new ObjectId();
      await db.collection("site_media").insertOne({ _id: id, url: "/brand/logo-mark.svg", objectKey: `site/a45-${tag}-${id.toHexString()}.png`, alt, width: 640, height: 480, bytes: 120_000, contentType: "image/png", tags: [], uploadedBy: "a45@example.test", altAuto: false, trashedAt: null, purgeAfter: null, focusX: 50, focusY: 50, createdAt: new Date() });
      return id;
    };
    const used = await make(`A45 ${tag} used picture`);
    const spare = await make(`A45 ${tag} spare picture`);
    const before = category?.photo ?? null;
    await db.collection("categories").updateOne({ _id: category!._id }, { $set: { photo: { mediaId: used, focusX: 50, focusY: 50, alt: "A45 category photo" } } });
    return { used, spare, categoryId: category!._id, categoryName: String(category?.name ?? ""), before };
  });
}

async function cleanUp(seeded: { used: ObjectId; spare: ObjectId; categoryId: ObjectId; before: unknown }) {
  await withLocalDb(async (db) => {
    await db.collection("site_media").deleteMany({ _id: { $in: [seeded.used, seeded.spare] } });
    await db.collection("categories").updateOne({ _id: seeded.categoryId }, seeded.before ? { $set: { photo: seeded.before } } : { $unset: { photo: "" } });
  });
}

const mediaOf = (id: ObjectId) => withLocalDb((db) => db.collection("site_media").findOne({ _id: id }));

test.describe("A45 media library", () => {
  test("open a picture, edit its alt text with Undo, see where it is used, and use the Trash", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(180_000);
    const tag = `t${Date.now().toString(36)}`;
    const seeded = await seed(tag);
    if (!seeded) {
      test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      return;
    }
    try {
      await signInAdminContext(context, baseURL!);
      await page.goto("/admin/media/");
      await expect(page.locator("h1")).toHaveText("Media library");
      await expect(page.getByRole("tab", { name: /Pictures/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Notices/ })).toHaveAttribute("href", "/admin/broadcasts/");
      await page.getByRole("searchbox", { name: "Search pictures" }).fill(`A45 ${tag}`);
      await expect(page).toHaveURL(/q=/);
      await expect(page.locator('[data-tk="media-grid"] li')).toHaveCount(2);
      await shot(page, "media-grid");

      await page.locator('[data-tk="media-grid"] button', { hasText: `A45 ${tag} used picture` }).click();
      const drawer = page.locator('[data-tk="media-drawer"]');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('[data-tk="media-usages"]')).toContainText(`Category > ${seeded.categoryName} > photo`);
      await expect(page.getByRole("button", { name: "Move to Trash" })).toBeDisabled();
      await shot(page, "media-used");
      await page.getByRole("button", { name: "Cancel" }).click();

      await page.locator('[data-tk="media-grid"] button', { hasText: `A45 ${tag} spare picture` }).click();
      await expect(drawer.locator('[data-tk="media-unused"]')).toBeVisible();
      await drawer.getByLabel(/^Alt text/).fill("x");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(drawer.getByText("Describe the picture in a few words.").first()).toBeVisible();
      await drawer.getByLabel(/^Alt text/).fill(`A45 ${tag} spare, new description`);
      await shot(page, "media-edit");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Picture saved.")).toBeVisible();
      expect((await mediaOf(seeded.spare))?.alt).toBe(`A45 ${tag} spare, new description`);
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText("Undone.")).toBeVisible();
      expect((await mediaOf(seeded.spare))?.alt).toBe(`A45 ${tag} spare picture`);

      await page.locator('[data-tk="media-grid"] button', { hasText: `A45 ${tag} spare picture` }).click();
      await page.getByRole("button", { name: "Move to Trash" }).click();
      await expect(page.getByText(/Moved to the Trash/)).toBeVisible();
      expect((await mediaOf(seeded.spare))?.trashedAt).toBeTruthy();

      await page.getByRole("tab", { name: /Trash/ }).click();
      await expect(page).toHaveURL(/tab=trash/);
      await page.locator('[data-tk="media-grid"] button', { hasText: `A45 ${tag} spare picture` }).click();
      await expect(drawer).toContainText("Removed for good on");
      await shot(page, "media-trash");
      await page.getByRole("button", { name: "Restore picture" }).click();
      await expect(page.getByText("Taken out of the Trash.")).toBeVisible();
      expect((await mediaOf(seeded.spare))?.trashedAt ?? null).toBeNull();
    } finally {
      await cleanUp(seeded);
    }
  });

  test("it fits 390, 768 and 1440 with no sideways scroll and passes axe", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/media/");
      await expect(page.locator("h1")).toHaveText("Media library");
      expect(await hasHorizontalScroll(page), `${size.width}`).toBe(false);
      await shot(page, "media-fit");
      const found = await new AxeBuilder({ page }).include('[data-tk="media-screen"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${size.width}`).toEqual([]);
    }
  });
});
