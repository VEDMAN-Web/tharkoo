import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.27 (A27): All ads at /admin/ads/. */

const SHOTS = process.env.A27_SHOTS ?? "";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const category = await db.collection("categories").findOne({});
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `A27 Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const rows = [
      [`A27 ${tag} sofa one`, "active"],
      [`A27 ${tag} sofa two`, "active"],
      [`A27 ${tag} sofa three`, "active"],
      [`A27 ${tag} waiting`, "pending"],
      ["htjkjjhhkh", "active"],
    ] as const;
    const ids: Record<string, ObjectId> = {};
    for (const [title, status] of rows) {
      const id = new ObjectId();
      ids[title] = id;
      await db.collection("listings").insertOne({
        _id: id,
        ownerId: owner,
        status,
        categoryId: category?._id ?? new ObjectId(),
        title,
        slug: `a27-${tag}-${id.toHexString().slice(-6)}`,
        description: "A well kept thing for sale.",
        feedHidden: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return ids;
  });
}

async function cleanUp(ids: Record<string, ObjectId>) {
  await withLocalDb(async (db) => {
    const owners = (await db.collection("listings").find({ _id: { $in: Object.values(ids) } }).project({ ownerId: 1 }).toArray()).map((row) => row.ownerId);
    await db.collection("listings").deleteMany({ _id: { $in: Object.values(ids) } });
    await db.collection("users").deleteMany({ _id: { $in: owners } });
    await db.collection("audit_events").deleteMany({ targetId: { $in: Object.values(ids).map(String) } });
  });
}

const statusOf = async (id: ObjectId) => withLocalDb(async (db) => (await db.collection("listings").findOne({ _id: id }))?.status as string);

test.describe("A27 All ads", () => {
  test("search, pick rows, pause them in one batch, and one Undo brings them all back", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    test.setTimeout(180_000);
    const tag = `t${Date.now().toString(36)}`;
    const ids = await seed(tag);
    if (!ids) {
      test.skip(true, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
      return;
    }
    try {
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/");
    await expect(page.locator("h1")).toHaveText("All ads");
    await expect(page.getByRole("tab", { name: /Demo ads/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /In review/ })).toContainText(/\d/);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "ads-list");

    await page.getByRole("searchbox", { name: "Search ads" }).fill(`A27 ${tag}`);
    const rows = page.locator('[data-tk="ads-screen"] tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(page).toHaveURL(/q=A27/);

    await page.getByRole("searchbox", { name: "Search ads" }).fill("htjkjjhhkh");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Looks like junk");
    await page.getByRole("searchbox", { name: "Search ads" }).fill("");
    // The cleared search navigates after a short pause; wait for it, or it can overwrite the filter picked next.
    await expect(page).not.toHaveURL(/[?&]q=/);
    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Looks like junk" }).click();
    await expect(page.locator('[data-tk="filter-chip"]')).toContainText("Looks like junk");
    await expect(rows.first()).toContainText("Looks like junk");
    await shot(page, "ads-junk-filter");
    await page.getByRole("button", { name: "Remove filter Looks like junk" }).click();
    await expect(page.locator('[data-tk="filter-chip"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/junk=1/);

    await page.getByRole("searchbox", { name: "Search ads" }).fill(`A27 ${tag} sofa`);
    await expect(rows).toHaveCount(3);
    await page.getByRole("checkbox", { name: "Select all rows on this page" }).check();
    await expect(page.getByText("3 selected")).toBeVisible();
    await shot(page, "ads-bulk-bar");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByText(/Paused: 3 ads/)).toBeVisible();
    for (const title of [`A27 ${tag} sofa one`, `A27 ${tag} sofa two`, `A27 ${tag} sofa three`]) expect(await statusOf(ids[title])).toBe("paused");
    await shot(page, "ads-paused-toast");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(/Undone\. 3 ads are back as before/)).toBeVisible();
    for (const title of [`A27 ${tag} sofa one`, `A27 ${tag} sofa two`, `A27 ${tag} sofa three`]) expect(await statusOf(ids[title])).toBe("active");

    await page.getByRole("checkbox", { name: `Select A27 ${tag} sofa one` }).check();
    await page.getByRole("button", { name: "Remove..." }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Remove 1 ad?");
    await shot(page, "ads-remove-dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await statusOf(ids[`A27 ${tag} sofa one`])).toBe("active");

    await page.goto("/admin/ads/?tab=review");
    await expect(page.locator('[data-tk="ads-screen"] tbody tr', { hasText: `A27 ${tag} waiting` })).toBeVisible();
    await page.goto("/admin/ads/?tab=live&paid=free&home=1");
    await expect(page.locator('[data-tk="filter-chip"]')).toHaveCount(2);
    await expect(page.locator('[data-tk="ads-empty"]')).toBeVisible();
    } finally {
      await cleanUp(ids);
    }
  });

  test("it fits 390, 768 and 1440 with no sideways scroll and passes axe", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
    await signInAdminContext(context, baseURL!);
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/admin/ads/");
      await expect(page.locator("h1")).toHaveText("All ads");
      await expect(page.locator('[data-tk="ads-screen"] tbody tr').first()).toBeVisible();
      expect(await hasHorizontalScroll(page), `${size.width}`).toBe(false);
      await shot(page, "ads-fit");
      const found = await new AxeBuilder({ page }).include('[data-tk="ads-screen"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(found.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`), `${size.width}`).toEqual([]);
      if (isPhone(page)) await expect(page.locator(".adm-ads-edit").first()).toBeHidden();
    }
  });
});
