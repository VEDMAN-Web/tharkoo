import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.33 (A33): the ad edit page and its history drawer. */

const SHOTS = process.env.A33_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({});
    const attributes: Record<string, unknown> = {};
    for (const field of (category?.fields ?? []) as { key: string; type: string; required?: boolean; enabled?: boolean; options?: string[]; min?: number }[]) {
      if (!field.required || field.enabled === false) continue;
      attributes[field.key] = field.type === "number" || field.type === "range" ? Math.max(field.min ?? 0, 30) : field.options?.length ? field.options[0] : "x";
    }
    const city = await db.collection("locations").findOne({ type: "city" });
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `A33 Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const id = new ObjectId();
    const doc = {
      _id: id,
      ownerId: owner,
      status: "active",
      categoryId: category?._id ?? new ObjectId(),
      cityId: city?._id,
      title: `A33 ${tag} flat near Adajan`,
      slug: `a33-${tag}`,
      description: "Spacious flat with lift and parking. Family or working people preferred.",
      price: 20000,
      attributes,
      feedHidden: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("listings").insertOne(doc);
    await db.collection("listing_versions").insertOne({ listingId: id, version: 1, snapshot: doc, actorId: owner, createdAt: new Date() });
    return { id, owner };
  });
}

async function cleanUp(seeded: { id: ObjectId; owner: ObjectId }) {
  await withLocalDb(async (db) => {
    await db.collection("listings").deleteOne({ _id: seeded.id });
    await db.collection("users").deleteOne({ _id: seeded.owner });
  });
}

const read = (id: ObjectId) => withLocalDb(async (db) => db.collection("listings").findOne({ _id: id }));

test.describe("A33 ad edit", () => {
  test("edit a live ad, it stays live, undo it, then go back to an older version from History", async ({ page, context, baseURL }, testInfo) => {
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
      await expect(page.locator("h1")).toHaveText(`A33 ${tag} flat near Adajan`);
      expect(await hasHorizontalScroll(page)).toBe(false);
      await shot(page, "ad-edit");

      await expect(page.getByLabel(/^Price/)).toHaveCount(0);
      await page.locator("#ae-desc").fill("Spacious flat with lift, parking and a balcony. Family preferred.");
      await expect(page.getByText("1 unsaved change")).toBeVisible();
      await page.getByLabel(/^Title/).fill("");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Enter a title.")).toBeVisible();
      await page.getByLabel(/^Title/).fill(`A33 ${tag} flat in Adajan`);
      await shot(page, "ad-edit-unsaved");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText(/Saved .*The ad stays live/)).toBeVisible();
      expect(await read(seeded.id)).toMatchObject({ status: "active", price: 20000, title: `A33 ${tag} flat in Adajan`, description: "Spacious flat with lift, parking and a balcony. Family preferred." });

      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText(/Undone\. The old values are back/)).toBeVisible();
      expect(await read(seeded.id)).toMatchObject({ status: "active", price: 20000, title: `A33 ${tag} flat near Adajan`, description: "Spacious flat with lift and parking. Family or working people preferred." });

      await page.getByRole("button", { name: "History" }).click();
      const drawer = page.locator('[data-tk="history"]');
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("v3");
      await expect(drawer).toContainText("v1");
      await shot(page, "ad-history");
      await drawer.getByText("v2").first().click();
      await expect(page.getByRole("button", { name: "Restore v2" })).toBeVisible();
      await shot(page, "ad-history-restore");
      await page.getByRole("button", { name: "Restore v2" }).click();
      await expect(page.getByText(/Went back to v2/)).toBeVisible();
      expect(await read(seeded.id)).toMatchObject({ status: "active", price: 20000, description: "Spacious flat with lift, parking and a balcony. Family preferred." });
    } finally {
      await cleanUp(seeded);
    }
  });

  test("it fits 390, 768 and 1440 with no sideways scroll and passes axe", async ({ page, context, baseURL }, testInfo) => {
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
        await expect(page.locator("h1")).toBeVisible();
        expect(await hasHorizontalScroll(page), `${size.width}`).toBe(false);
        await shot(page, "ad-edit-fit");
        const found = await new AxeBuilder({ page }).include('[data-tk="ad-edit"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${size.width}`).toEqual([]);
      }
    } finally {
      await cleanUp(seeded);
    }
  });
});
