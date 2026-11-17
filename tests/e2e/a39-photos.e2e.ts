import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.39 (A39): picture pickers (photo and band) on Categories and on Locations, from the media library. */

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

async function pickFromLibrary(page: Page, section: ReturnType<Page["locator"]>, alt: string) {
  await section.getByRole("button", { name: "Choose image" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search images").fill(alt);
  await dialog.getByTitle(alt).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("H8.39 catalogue pictures", () => {
  test("a category gets a photo and a band from the library with a description, Undo puts them back, and the library image is kept", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const alt = `A39 library picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/categories/");
    const card = page.locator("[data-tk=catalog-pictures]");
    await card.scrollIntoViewIfNeeded();
    expect(await hasHorizontalScroll(page)).toBe(false);
    const select = card.getByLabel("Choose a category");
    const options = await select.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
    await select.selectOption({ index: 1 });
    const name = options[1].replace(/\s*\(.*\)$/, "");
    await expect(card.getByRole("heading", { name })).toBeVisible();

    await pickFromLibrary(page, card.getByRole("region", { name: new RegExp(`^Photo of`) }), alt);
    await pickFromLibrary(page, card.getByRole("region", { name: new RegExp(`^Band of`) }), alt);
    await expect(card.getByLabel(/^Picture description/).first()).toHaveValue(alt);
    await card.getByLabel(/^Picture description/).first().fill("A flat with a balcony");
    const axe = await new AxeBuilder({ page }).include("[data-tk=catalog-pictures]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => `${item.id}: ${item.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shot(page, "a39-categories-pictures", card);

    await card.getByRole("button", { name: "Save pictures" }).click();
    await expect(card.getByText(`Saved the pictures of ${name}.`)).toBeVisible();
    const saved = await withLocalDb((db) => db.collection("categories").findOne({ name }, { projection: { photo: 1, band: 1 } }));
    expect(saved?.photo?.alt).toBe("A flat with a balcony");
    expect(saved?.band?.alt).toBe(alt);

    await card.getByRole("button", { name: "Undo" }).click();
    await expect(card.getByText("Undone. The old pictures are back.")).toBeVisible();
    const back = await withLocalDb((db) => db.collection("categories").findOne({ name }, { projection: { photo: 1, band: 1 } }));
    expect(back?.photo ?? null).toBeNull();
    expect(back?.band ?? null).toBeNull();
    await staff.close();
  });

  test("a place is found by the first letters, gets a photo, and a missing description is refused before saving", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const alt = `A39 place picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/locations/");
    const card = page.locator("[data-tk=catalog-pictures]");
    await card.scrollIntoViewIfNeeded();
    const first = (await card.getByLabel("Choose a place").locator("option").allTextContents())[1];
    expect(first).toBeTruthy();
    const name = first.replace(/\s*\(.*\)$/, "");
    await card.getByLabel("Find a place").fill(name.slice(0, 3));
    await card.getByRole("button", { name: "Search" }).click();
    await expect(card.getByLabel("Choose a place")).toContainText(name);
    await card.getByLabel("Choose a place").selectOption({ label: first });
    await pickFromLibrary(page, card.getByRole("region", { name: /^Photo of/ }), alt);
    await card.getByLabel(/^Picture description/).first().fill("");
    await card.getByRole("button", { name: "Save pictures" }).click();
    await expect(card.getByText("Add a picture description before saving.")).toBeVisible();
    await card.getByLabel(/^Picture description/).first().fill("The old city at dusk");
    await card.getByRole("button", { name: "Save pictures" }).click();
    await expect(card.getByText(`Saved the pictures of ${name}.`)).toBeVisible();
    await shot(page, "a39-locations-pictures", card);
    await staff.close();
  });
});
