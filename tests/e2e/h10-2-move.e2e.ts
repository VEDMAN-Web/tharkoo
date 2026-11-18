import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H10.2: All ads, "Move to category": the selected ads or every ad that matches the filters, one change, one Undo. */

const SHOTS = process.env.H102_SHOTS_DIR ?? "";

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

/** Two categories of their own and 60 ads in the first, so the list has more than one page of ads that match one filter. */
async function seed(tag: string) {
  const ids = await withLocalDb(async (db) => {
    const now = new Date();
    const from = await db.collection("categories").insertOne({ slug: `h102-from-${tag}`, name: `H102 Old ${tag}`, enabled: true, order: 900, createdAt: now, updatedAt: now });
    const to = await db.collection("categories").insertOne({ slug: `h102-to-${tag}`, name: `H102 New ${tag}`, enabled: true, order: 901, createdAt: now, updatedAt: now });
    const owner = new ObjectId();
    const sub = new ObjectId();
    await db.collection("listings").insertMany(
      Array.from({ length: 60 }, (_, index) => ({
        ownerId: owner,
        categoryId: from.insertedId,
        subcategoryId: sub,
        title: `H102 ad ${tag} ${String(index).padStart(2, "0")}`,
        description: "A description that is long enough for the test.",
        slug: `h102-${tag}-${index}`,
        status: "active",
        createdAt: new Date(now.getTime() - index * 1000),
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 40 * 3_600_000),
      })),
    );
    return { from: String(from.insertedId), to: String(to.insertedId) };
  });
  expect(ids).not.toBeNull();
  return ids!;
}

test.describe("H10.2 Move to category", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("select one ad, choose every ad that matches the filter, type the number, move 60 ads to another category, and Undo puts them back (1440 and 390)", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const tag = String(Date.now() % 1_000_000);
    const { from, to } = await seed(tag);
    const count = async (categoryId: string) => (await withLocalDb((db) => db.collection("listings").countDocuments({ categoryId: new ObjectId(categoryId) }))) ?? -1;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/ads/?cat=${from}`);
    await expect(page.getByText(`H102 ad ${tag} 00`)).toBeVisible();
    await page.getByRole("checkbox", { name: `Select H102 ad ${tag} 00` }).check();
    await page.locator('[data-tk="bulk-bar"]').getByRole("button", { name: "Move to category..." }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Move ads to another category" })).toBeVisible();
    // Nothing is chosen for the person.
    await expect(dialog.getByLabel("Move to")).toHaveValue("");
    await dialog.getByRole("button", { name: "Move 1 ad" }).click();
    await expect(dialog.locator('[data-tk="move-error"]')).toContainText("Choose the category");
    await dialog.getByLabel("Move to").selectOption(to);
    await dialog.getByLabel(/^All 60 ads that match the current filters/).check();
    await expect(dialog.getByRole("button", { name: "Move 60 ads" })).toBeVisible();
    await dialog.getByRole("button", { name: "Move 60 ads" }).click();
    await expect(dialog.locator('[data-tk="move-error"]')).toContainText("Type 60");
    await shot(page, "move-dialog");
    // The same dialog on a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "move-dialog");
    await page.setViewportSize({ width: 1440, height: 900 });
    await dialog.getByLabel("Type 60 to confirm").fill("60");
    await dialog.getByRole("button", { name: "Move 60 ads" }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText(`Moved 60 ads to H102 New ${tag}.`);
    await expect.poll(async () => await count(to)).toBe(60);
    expect(await count(from)).toBe(0);
    const moved = await withLocalDb((db) => db.collection("listings").findOne({ slug: `h102-${tag}-3` }, { projection: { subcategoryId: 1 } }));
    expect(moved?.subcategoryId ?? null).toBeNull();
    await shot(page, "moved");
    await page.locator('[data-tk="toast"]').getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => await count(from)).toBe(60);
    expect(await count(to)).toBe(0);
    const back = await withLocalDb((db) => db.collection("listings").findOne({ slug: `h102-${tag}-3` }, { projection: { subcategoryId: 1 } }));
    expect(back?.subcategoryId ?? null).not.toBeNull();
    await withLocalDb(async (db) => {
      await db.collection("listings").deleteMany({ slug: { $regex: `^h102-${tag}-` } });
      await db.collection("categories").deleteMany({ slug: { $in: [`h102-from-${tag}`, `h102-to-${tag}`] } });
    });
  });
});
