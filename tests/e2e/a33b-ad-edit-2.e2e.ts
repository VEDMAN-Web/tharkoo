import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, PNG, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.33 part 2: photos, category and place on the ad edit page. */

const SHOTS = process.env.A33B_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

type Field = { key: string; type: string; required?: boolean; enabled?: boolean; options?: string[]; min?: number };

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const categories = await db.collection("categories").find({ deletedAt: null }).limit(40).toArray();
    const plain = categories.filter((row) => !(row.fields ?? []).some((field: Field) => field.required && field.enabled !== false));
    const category = plain[0] ?? categories[0];
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `A33b Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const photoIds: ObjectId[] = [];
    for (let index = 0; index < 2; index += 1) {
      const id = new ObjectId();
      await db.collection("media_assets").insertOne({ _id: id, ownerId: owner, kind: "image", objectKey: "/brand/logo-mark.svg", status: "cleared", contentType: "image/svg+xml", bytes: 1000, createdAt: new Date() });
      photoIds.push(id);
    }
    const city = await db.collection("locations").findOne({ type: "city" });
    const id = new ObjectId();
    const attributes: Record<string, unknown> = {};
    for (const field of (category?.fields ?? []) as Field[]) {
      if (!field.required || field.enabled === false) continue;
      attributes[field.key] = field.type === "number" || field.type === "range" ? Math.max(field.min ?? 0, 30) : field.options?.length ? field.options[0] : "x";
    }
    const doc = {
      _id: id,
      ownerId: owner,
      status: "active",
      categoryId: category!._id,
      cityId: city?._id,
      title: `A33b ${tag} flat near Adajan`,
      slug: `a33b-${tag}`,
      description: "Spacious flat with lift and parking. Family or working people preferred.",
      price: 20000,
      attributes,
      mediaIds: photoIds,
      coverMediaId: photoIds[0],
      feedHidden: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("listings").insertOne(doc);
    await db.collection("listing_versions").insertOne({ listingId: id, version: 1, snapshot: doc, actorId: owner, createdAt: new Date() });
    return { id, owner, photoIds, categoryId: category!._id };
  });
}

type Seeded = { id: ObjectId; owner: ObjectId; photoIds: ObjectId[]; categoryId: ObjectId };

async function cleanUp(seeded: Seeded) {
  await withLocalDb(async (db) => {
    await db.collection("listings").deleteOne({ _id: seeded.id });
    await db.collection("media_assets").deleteMany({ ownerId: seeded.owner });
    await db.collection("users").deleteOne({ _id: seeded.owner });
  });
}

const read = (id: ObjectId) => withLocalDb(async (db) => db.collection("listings").findOne({ _id: id }));

test.describe("A33 part 2: ad edit photos, category and place", () => {
  test("change the photo order, remove one, add one, save with the ad staying live, then Undo", async ({ page, context, baseURL }, testInfo) => {
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
      await page.goto(`/admin/ads/${seeded.id.toHexString()}/`);
      const photos = page.locator('[data-tk="ad-photos"]');
      await expect(photos.locator("[data-state=ready]")).toHaveCount(2);
      await expect(photos.locator(".upl-cover")).toHaveCount(1);
      await shot(page, "ad-photos");

      await photos.getByRole("button", { name: "Make Photo 2 the cover" }).click();
      await expect(page.getByText("1 unsaved change")).toBeVisible();
      await photos.locator("input[type=file]").setInputFiles([{ name: "extra.png", mimeType: "image/png", buffer: PNG }]);
      await expect(photos.locator("[data-state=ready]")).toHaveCount(3, { timeout: 30_000 });
      await photos.getByRole("button", { name: "Remove Photo 1" }).click();
      await expect(photos.locator("[data-state=ready]")).toHaveCount(2);
      await shot(page, "ad-photos-changed");

      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText(/Saved .*The ad stays live/)).toBeVisible({ timeout: 20_000 });
      const after = await read(seeded.id);
      expect(after?.status).toBe("active");
      expect((after?.mediaIds as ObjectId[]).length).toBe(2);
      expect(String((after?.mediaIds as ObjectId[])[0])).toBe(String(seeded.photoIds[1]));
      expect(String(after?.coverMediaId)).toBe(String(seeded.photoIds[1]));

      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText(/Undone\. The old values are back/)).toBeVisible();
      const undone = await read(seeded.id);
      expect((undone?.mediaIds as ObjectId[]).map(String)).toEqual(seeded.photoIds.map(String));
      expect(String(undone?.categoryId)).toBe(String(seeded.categoryId));
      expect(undone?.status).toBe("active");
    } finally {
      await cleanUp(seeded);
    }
  });

  test("the edit page with photos and the place picker fits 390, 768 and 1440 with no sideways scroll and passes axe", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(180_000);
    const tag = `t${Date.now().toString(36)}b`;
    const seeded = await seed(tag);
    if (!seeded) {
      test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      return;
    }
    try {
      await signInAdminContext(context, baseURL!);
      for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await page.goto(`/admin/ads/${seeded.id.toHexString()}/`);
        await expect(page.locator('[data-tk="ad-location"]')).toBeVisible();
        expect(await hasHorizontalScroll(page), `${size.width}`).toBe(false);
        await shot(page, "ad-edit-2-fit");
        const found = await new AxeBuilder({ page }).include('[data-tk="ad-edit"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${size.width}`).toEqual([]);
      }
    } finally {
      await cleanUp(seeded);
    }
  });
});
