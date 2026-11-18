import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, loginUi, newApi, registerApi, signInAdminContext, test, uniqueEmail, USER_PASSWORD, withLocalDb } from "./helpers";

/** H10.1: a people category keeps its adults-only age check whatever it is called or has in its form; leaving People asks first and can be undone. */

const SHOTS = process.env.H101_SHOTS_DIR ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

async function serious(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`);
}

/** A renamed people category: a new name and address, the People kind, and one field, Interest, with no age field. */
async function seedPeopleCategory(slug: string, name: string) {
  await withLocalDb((db) =>
    db.collection("categories").insertOne({
      slug,
      name,
      enabled: true,
      kind: "people",
      videoTourEnabled: false,
      order: 99,
      deletedAt: null,
      fields: [{ key: "interest", label: "Interest", type: "select", required: true, options: ["Coffee", "Walks"], order: 0, enabled: true }],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

/** Removes the seeded category in the admin screen, so what visitors see is refreshed and later tests see the same list as before. */
async function removeCategory(page: Page, slug: string) {
  // The poster left a draft in it; a category with ads is only hidden, so the draft goes first.
  await withLocalDb(async (db) => {
    const row = await db.collection("categories").findOne({ slug }, { projection: { _id: 1 } });
    if (row) await db.collection("listings").deleteMany({ categoryId: row._id });
  });
  await page.goto(`/admin/categories/?c=${slug}`);
  await page.locator("[data-tk=category-detail]").getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Remove category" }).click();
  const confirm = page.getByRole("alertdialog");
  await confirm.getByRole("textbox").fill(slug);
  await confirm.getByRole("button", { name: "Remove category" }).click();
  await expect.poll(async () => await withLocalDb((db) => db.collection("categories").countDocuments({ slug }))).toBe(0);
}

test.describe("H10.1 people protection", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("changing a category's Kind away from People asks first, can be cancelled, is saved with an Undo, and the age check stays for People", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const stamp = String(Date.now() % 1000000);
    const slug = `h101-circle-${stamp}`;
    await seedPeopleCategory(slug, `H101 Circle ${stamp}`);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/categories/?c=${slug}`);
    await expect(page.getByRole("heading", { name: `H101 Circle ${stamp}` })).toBeVisible();
    await page.getByLabel(/^Kind/).selectOption("service");
    await page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true }).click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toContainText("This turns off the adults-only check and the no-video rule for this category. Continue?");
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "ask");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect((await withLocalDb((db) => db.collection("categories").findOne({ slug }, { projection: { kind: 1 } })))?.kind).toBe("people");
    await page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true }).click();
    await page.locator('[data-tk="reason-dialog"]').getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[data-tk="toast"]').first()).toBeVisible();
    await expect.poll(async () => (await withLocalDb((db) => db.collection("categories").findOne({ slug }, { projection: { kind: 1 } })))?.kind).toBe("service");
    await page.locator('[data-tk="toast"]').getByRole("button", { name: /Undo/ }).click();
    await expect.poll(async () => (await withLocalDb((db) => db.collection("categories").findOne({ slug }, { projection: { kind: 1 } })))?.kind).toBe("people");
    await shot(page, "undone");
    await removeCategory(page, slug);
  });

  test("a renamed people category with no age field in its form still asks for an age of 18 or more, on a laptop and on a phone", async ({ page, browser, baseURL }) => {
    test.setTimeout(300_000);
    const stamp = String(Date.now() % 1000000);
    const name = `H101 Circle ${stamp}`;
    const slug = `h101-circle-${stamp}`;
    await seedPeopleCategory(slug, `H101 Seed ${stamp}`);
    // The rename is made in the admin screen, which also refreshes what visitors see.
    const staff = await browser.newContext({ baseURL });
    const admin = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await admin.setViewportSize({ width: 1440, height: 900 });
    await admin.goto(`/admin/categories/?c=${slug}`);
    await admin.getByRole("textbox", { name: /^Name/ }).fill(name);
    await admin.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true }).click();
    await expect(admin.locator('[data-tk="toast"]').first()).toContainText("Saved");
    const email = uniqueEmail("h101age");
    const signup = await newApi(baseURL!);
    await registerApi(signup, baseURL!, email);
    await signup.dispose();
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await loginUi(page, email, USER_PASSWORD, "/u/post-insert/");
      await page.goto("/u/post-insert/");
      await expect(page.locator(".tkp-tile", { hasText: name })).toBeVisible({ timeout: 60_000 });
      await page.locator(".tkp-tile", { hasText: name }).click();
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 2 of");
      await expect(page.locator("#age")).toBeVisible();
      await page.locator("#nickname").fill("Asha");
      await page.locator("#title").fill("Coffee and a walk this weekend");
      await page.locator("#text").fill("A friendly person looking for company for coffee and a walk.");
      await page.getByRole("button", { name: "Coffee", exact: true }).click();
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=field-error]").first()).toContainText("Enter your age (18 or over).");
      await page.locator("#age").fill("17");
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=field-error]").first()).toContainText("Enter your age (18 or over).");
      await page.locator("#age").fill("28");
      await page.locator("[data-tk=go-on]").click();
      await expect(page.locator("[data-tk=step-of]")).toContainText("Step 3 of");
      expect(await hasHorizontalScroll(page)).toBe(false);
      expect(await serious(page)).toEqual([]);
      await shot(page, "age");
    }
    await removeCategory(admin, slug);
    await staff.close();
  });
});
