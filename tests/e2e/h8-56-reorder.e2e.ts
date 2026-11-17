import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.56: drag to reorder places on Cities & areas. */

const SHOTS = process.env.H856_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png` });
}

/** Four cities that sort first (negative Order numbers), so they are on page 1 whatever else is in the test database. */
async function seedFour(tag: string) {
  const names = ["Alpha", "Bravo", "Charlie", "Delta"].map((word) => `H856 ${word} ${tag}`);
  const ok = await withLocalDb(async (db) => {
    const now = new Date();
    const state = await db.collection("locations").findOne({ type: "state" });
    await db.collection("locations").deleteMany({ slug: { $regex: "^h856-" } });
    await db.collection("locations").insertMany(names.map((name, index) => ({ type: "city", slug: `h856-${tag}-${index}`, name, parentId: state?._id ?? null, enabled: true, order: -9000 + index, createdAt: now, updatedAt: now })));
    return true;
  });
  expect(ok).toBe(true);
  return names;
}

const firstFour = async (page: Page) => (await page.locator('[data-tk="place-row"] strong').allTextContents()).slice(0, 4);
const orderInDb = async (names: string[]) => (await withLocalDb(async (db) => (await db.collection("locations").find({ name: { $in: names } }).sort({ order: 1 }).project({ name: 1 }).toArray()).map((row) => String(row.name)))) ?? [];

test.describe("H8.56 reorder places", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("arrows and dragging change the order and it is saved; a search turns reordering off; works with arrows on a phone", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const tag = String(Date.now() % 100000);
    const names = await seedFour(tag);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/locations/");
    await expect(page.locator('[data-tk="place-row"]').first()).toBeVisible();
    expect(await firstFour(page)).toEqual(names);
    await expect(page.locator('[data-tk="place-order-note"]')).toBeVisible();
    await shot(page, "reorder-list");

    await page.getByRole("button", { name: `Move ${names[1]} up` }).click();
    await expect(page.locator('[data-tk="toast"]')).toContainText("Order saved.");
    expect(await firstFour(page)).toEqual([names[1], names[0], names[2], names[3]]);
    await expect.poll(async () => await orderInDb(names)).toEqual([names[1], names[0], names[2], names[3]]);

    // Dragging the grip of the last one onto the first.
    await page.locator('[data-tk="place-row"]').nth(3).locator('[data-tk="place-grip"]').dragTo(page.locator('[data-tk="place-row"]').nth(0));
    await expect(page.locator('[data-tk="toast"]')).toContainText("Order saved.");
    await expect.poll(async () => await orderInDb(names)).toEqual([names[3], names[1], names[0], names[2]]);
    await page.reload();
    expect(await firstFour(page)).toEqual([names[3], names[1], names[0], names[2]]);
    await expect(page.getByRole("button", { name: `Move ${names[3]} up` })).toBeDisabled();

    // A search shows a part of the list, so there is no drag handle and no arrows.
    await page.locator('[data-tk="place-search"]').fill("H856 Alpha");
    await expect(page.locator('[data-tk="place-row"]')).toHaveCount(1);
    await expect(page.locator('[data-tk="place-grip"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Move .* up$/ })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/locations/");
    await expect(page.getByRole("button", { name: `Move ${names[1]} up` })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "reorder-list");
    await page.getByRole("button", { name: `Move ${names[1]} down` }).click();
    await expect.poll(async () => await orderInDb(names)).toEqual([names[3], names[0], names[1], names[2]]);
  });
});
