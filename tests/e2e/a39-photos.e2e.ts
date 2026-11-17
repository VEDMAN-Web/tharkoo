import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.39 (A39): one clear box for each picture (card photo, band for computers, band for phones) on Categories and on Locations. */

const SHOTS = process.env.A39_SHOTS ?? "";

async function shot(page: Page, name: string, locator?: ReturnType<Page["locator"]>) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  const path = `${SHOTS}/${name}-${size?.width}x${size?.height}.png`;
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
}

async function seedPicture(alt: string) {
  const id = await withLocalDb(async (db) => {
    const row = await db.collection("site_media").insertOne({ url: "/favicon.ico", objectKey: `a39-${Date.now()}-${Math.random()}`, alt, width: 1920, height: 700, bytes: 1000, contentType: "image/png", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() });
    return String(row.insertedId);
  });
  expect(id).not.toBeNull();
  return id!;
}

async function pickFromLibrary(page: Page, box: ReturnType<Page["locator"]>, alt: string) {
  await box.getByRole("button", { name: "Choose image" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search images").fill(alt);
  await dialog.getByTitle(alt).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("H8.39 catalogue pictures", () => {
  test("a category shows what is set and what is missing, gets a card photo and a band from the library, and Undo takes them off again", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const alt = `A39 library picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/categories/");
    await page.waitForLoadState("networkidle");
    const card = page.locator("[data-tk=catalog-pictures]");
    await card.scrollIntoViewIfNeeded();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const rows = card.locator("[data-tk=pictures-row]");
    expect(await rows.count()).toBeGreaterThan(1);
    const row = rows.nth(test.info().project.name.startsWith("phone") ? 0 : 1);
    const name = (await row.locator("strong").first().textContent()) ?? "";
    await expect(row).toContainText("Card: missing");
    await row.getByRole("button", { name: "Edit pictures" }).click();

    const cardBox = row.locator('[data-slot="Card photo"]');
    const bandBox = row.locator('[data-slot="Band, computers"]');
    const phoneBox = row.locator('[data-slot="Band, phones"]');
    for (const box of [cardBox, bandBox, phoneBox]) await expect(box).toBeVisible();
    await expect(cardBox).toContainText("1200 x 800 px (3:2)");
    await expect(bandBox).toContainText("1600 x 500 px");
    await expect(phoneBox).toContainText("800 x 1000 px");

    await pickFromLibrary(page, cardBox, alt);
    await pickFromLibrary(page, bandBox, alt);
    await cardBox.getByLabel(/^Describe the picture/).fill("A flat with a balcony");
    const axe = await new AxeBuilder({ page }).include("[data-tk=catalog-pictures]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a39-categories-pictures", card);

    await row.getByRole("button", { name: "Save pictures" }).click();
    await expect(row.getByText(`Saved the pictures of ${name}.`)).toBeVisible();
    await expect(row).toContainText("Card: set");
    await expect(row).toContainText("Band: set");
    const saved = await withLocalDb((db) => db.collection("categories").findOne({ name }, { projection: { photo: 1, band: 1 } }));
    expect(saved?.photo?.alt).toBe("A flat with a balcony");
    expect(saved?.band?.alt).toBe(alt);

    await row.getByRole("button", { name: "Undo" }).click();
    await expect(row.getByText("Undone. The old pictures are back.")).toBeVisible();
    const back = await withLocalDb((db) => db.collection("categories").findOne({ name }, { projection: { photo: 1, band: 1 } }));
    expect(back?.photo ?? null).toBeNull();
    expect(back?.band ?? null).toBeNull();
    await staff.close();
  });

  test("a place is found by the first letters, gets a card photo, and a missing description is refused before saving", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const alt = `A39 place picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/locations/");
    await page.waitForLoadState("networkidle");
    const card = page.locator("[data-tk=catalog-pictures]");
    await card.scrollIntoViewIfNeeded();
    const first = (await card.locator("[data-tk=pictures-row]").first().locator("strong").first().textContent()) ?? "";
    expect(first).toBeTruthy();
    await card.getByLabel("Find a place").fill(first.slice(0, 1));
    await card.getByRole("button", { name: "Search" }).click();
    // A place with no card photo yet, so a run on the other screen size does not change what this one starts from.
    const open = card.locator("[data-tk=pictures-row]", { hasText: "Card: missing" }).first();
    await expect(open).toBeVisible();
    const name = (await open.locator("strong").first().textContent()) ?? "";
    const row = card.locator("[data-tk=pictures-row]", { hasText: name }).first();
    await row.getByRole("button", { name: "Edit pictures" }).click();
    const cardBox = row.locator('[data-slot="Card photo"]');
    await pickFromLibrary(page, cardBox, alt);
    await cardBox.getByLabel(/^Describe the picture/).fill("");
    await row.getByRole("button", { name: "Save pictures" }).click();
    await expect(row.getByText("Add a picture description before saving.")).toBeVisible();
    await cardBox.getByLabel(/^Describe the picture/).fill("The old city at dusk");
    await row.getByRole("button", { name: "Save pictures" }).click();
    await expect(row.getByText(`Saved the pictures of ${name}.`)).toBeVisible();
    await expect(row).toContainText("Card: set");
    await shot(page, "a39-locations-pictures", card);
    await staff.close();
  });
});
