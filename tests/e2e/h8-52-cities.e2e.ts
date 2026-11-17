import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.52: Cities & areas as one master-detail screen. */

const SHOTS = process.env.H852_SHOTS_DIR ?? "";
const SIZES = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

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

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const toast = (page: Page) => page.locator('[data-tk="toast"]');
const saveButton = (page: Page) => page.locator('[data-tk="save-bar"]').getByRole("button", { name: "Save", exact: true });

async function seedPicture(alt: string, url = "/placeholders/buy-and-sell/01.webp") {
  const id = await withLocalDb(async (db) => {
    const row = await db.collection("site_media").insertOne({ url, objectKey: `h852-${Date.now()}-${Math.random()}`, alt, width: 1200, height: 800, bytes: 1000, contentType: "image/webp", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() });
    return String(row.insertedId);
  });
  expect(id).not.toBeNull();
  return id!;
}

async function pick(page: Page, box: Locator, alt: string) {
  await box.getByRole("button", { name: /Choose image|Change image/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search images").fill(alt);
  await dialog.getByTitle(alt).click();
  await expect(dialog).toHaveCount(0);
}

/** A state of its own and 70 cities in it, so the list has more than one page whatever else is in the test database. */
async function seedCrowd(tag: string) {
  const ids = await withLocalDb(async (db) => {
    const now = new Date();
    const country = await db.collection("locations").findOne({ type: "country" });
    const state = await db.collection("locations").insertOne({ type: "state", slug: `${tag}-state`, name: `H852 State ${tag}`, parentId: country?._id ?? null, enabled: true, order: 0, createdAt: now, updatedAt: now });
    const cities = await db.collection("locations").insertMany(
      Array.from({ length: 70 }, (_, index) => ({ type: "city", slug: `${tag}-town-${String(index).padStart(3, "0")}`, name: `H852 Town ${tag} ${String(index).padStart(3, "0")}`, parentId: state.insertedId, enabled: true, order: index, createdAt: now, updatedAt: now })),
    );
    return { state: String(state.insertedId), first: String(cities.insertedIds[0]) };
  });
  expect(ids).not.toBeNull();
  return ids!;
}

async function open(page: Page, query = "") {
  await page.goto(`/admin/locations/${query}`);
  await expect(page.locator('[data-tk="places-screen"]')).toBeVisible();
}

test.describe("H8.52 Cities and areas", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one screen titled Cities & areas: one list, three tabs, no Save and Remove on every row, no sideways scroll and axe clean at 1440, 768 and 390", async ({ page, context, baseURL }) => {
    test.setTimeout(420_000);
    await signInAdminContext(context, baseURL!);
    await seedCrowd("lay");
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cities & areas");
      await expect(page.getByText("Saving writes Mongo")).toHaveCount(0);
      await expect(page.locator('[data-tk="place-list"]')).toHaveCount(1);
      expect(await page.locator('[data-tk="place-row"]').count()).toBeGreaterThan(2);
      await expect(page.getByRole("button", { name: "New place" })).toBeVisible();
      await expect(page.locator('[data-tk="place-row"]').getByRole("button", { name: /Save|Remove/ })).toHaveCount(0);
      const phone = size.width < 900;
      if (phone) {
        await expect(page.locator('[data-tk="place-detail"]')).toBeHidden();
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "list");
        await page.locator('[data-tk="place-row"] a').first().click();
        await expect(page.locator('[data-tk="place-detail"]')).toBeVisible();
        await expect(page.locator('[data-tk="place-list"]')).toBeHidden();
        await expect(page.locator('[data-tk="place-back"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-tk="place-detail"]')).toBeVisible();
        await expect(page.getByRole("button", { name: "More" })).toHaveCount(1);
      }
      await expect(page.locator('[data-tk="place-detail"]')).toHaveAttribute("data-type", "city");
      for (const name of ["Details", "Pictures", "Areas"]) {
        await tab(page, name).click();
        await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
        if (name === "Areas") await expect(page.locator('[data-tk="areas-tab"]')).toBeVisible();
        else await expect(page.locator('[data-tk="save-bar"]')).toHaveCount(1);
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, `tab-${name.toLowerCase()}`);
      }
      if (phone) {
        await page.locator('[data-tk="place-back"]').click();
        await expect(page.locator('[data-tk="place-list"]')).toBeVisible();
        await expect(page.locator('[data-tk="place-detail"]')).toBeHidden();
      }
    }
  });

  test("every place is reachable: more than one page, cities first, Next and Previous, a search that finds a place on any page, and an address that names a place on another page", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    const { first } = await seedCrowd("pg");
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const total = Number(((await page.locator('[data-tk="place-total"]').textContent()) ?? "").replace(/\D/g, ""));
    expect(total).toBeGreaterThan(70);
    await expect(page.locator('[data-tk="place-row"]')).toHaveCount(30);
    await expect(page.locator('[data-tk="place-row"]').first()).toHaveAttribute("data-type", "city");
    const pages = Math.ceil(total / 30);
    await expect(page.locator('[data-tk="place-pager"]')).toContainText(`Page 1 of ${pages}`);
    await page.locator('[data-tk="page-next"]').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('[data-tk="place-pager"]')).toContainText(`Page 2 of ${pages}`);
    await page.locator('[data-tk="page-prev"]').click();
    await expect(page.locator('[data-tk="place-pager"]')).toContainText(`Page 1 of ${pages}`);
    await open(page, "?page=9999");
    await expect(page.locator('[data-tk="place-pager"]')).toContainText(`Page ${pages} of ${pages}`);
    const last = await page.locator('[data-tk="place-row"]').last().getAttribute("data-type");
    expect(["city", "state", "country"]).toContain(last);

    await open(page);
    await page.locator('[data-tk="place-search"]').fill("H852 Town pg 069");
    await expect(page.locator('[data-tk="place-row"]')).toHaveCount(1);
    await expect(page.locator('[data-tk="place-row"]')).toContainText("H852 Town pg 069");
    await open(page, `?place=${first}&q=zzzz-nothing`);
    await expect(page.locator('[data-tk="place-empty"]')).toContainText("No place matches this search.");
    await expect(page.locator('[data-tk="place-detail"]')).toContainText("H852 Town pg 000");
  });

  test("New place, then Details save with ONE save bar, hide with the switch (shown as Hidden in the list), and Remove with a typed confirm", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await signInAdminContext(context, baseURL!);
    const { state } = await seedCrowd("dt");
    const stamp = String(Date.now() % 1000000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await page.getByRole("button", { name: "New place" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create place" }).click();
    await expect(dialog.locator('[data-tk="new-place-error"]')).toContainText("Write a name");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`H852 New ${stamp}`);
    await expect(dialog.getByRole("textbox", { name: /^Web address/ })).toHaveValue(`h852-new-${stamp}`);
    await dialog.getByRole("button", { name: "Create place" }).click();
    await expect(dialog.locator('[data-tk="new-place-error"]')).toContainText("Choose the state");
    await dialog.getByLabel(/^State/).selectOption(state);
    await dialog.getByRole("button", { name: "Create place" }).click();
    await expect(page).toHaveURL(/place=/);
    await expect(page.getByRole("heading", { name: `H852 New ${stamp}` })).toBeVisible();
    await expect(page.locator('[data-tk="save-bar"]')).toHaveCount(1);

    await page.getByRole("textbox", { name: /^Name/ }).fill(`H852 Renamed ${stamp}`);
    await page.getByLabel("Order").fill("5");
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("Unsaved changes");
    await page.getByRole("switch", { name: "Visible on site" }).click();
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved. Live on the site in a few seconds.");
    const saved = await withLocalDb((db) => db.collection("locations").findOne({ slug: `h852-new-${stamp}` }, { projection: { name: 1, order: 1, enabled: 1 } }));
    expect(saved).toMatchObject({ name: `H852 Renamed ${stamp}`, order: 5, enabled: false });
    await expect(page.locator('[data-tk="place-row"][aria-current], [data-tk="place-row"].is-selected').first()).toContainText("Hidden");
    await expect(page.locator('[data-tk="view-place"]')).toHaveAttribute("href", `/cities/h852-new-${stamp}/`);

    await page.locator("[data-tk=place-detail]").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Remove place" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`h852-new-${stamp}`);
    await confirm.getByRole("button", { name: "Remove place" }).click();
    await expect.poll(async () => await withLocalDb((db) => db.collection("locations").countDocuments({ slug: `h852-new-${stamp}` }))).toBe(0);
  });

  test("Pictures: three boxes with the new names, set a tile and a banner, save once, the list shows the thumbnail, and Undo takes them off", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await signInAdminContext(context, baseURL!);
    const { first } = await seedCrowd("pic");
    const alt = `H852 picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `?place=${first}&q=${encodeURIComponent("H852 Town pic 000")}&tab=pictures`);
    for (const title of ["Home page tile", "Top banner for computers", "Top banner for phones (optional)"]) await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByLabel(/^Left/)).toHaveCount(0);
    await pick(page, page.locator('[data-tk="picture-box"][data-slot="tile"]'), alt);
    await pick(page, page.locator('[data-tk="picture-box"][data-slot="banner"]'), alt);
    await page.locator('[data-tk="picture-box"][data-slot="tile"]').getByLabel(/^Describe the picture/).fill("A busy square in the evening");
    await page.locator('[data-tk="picture-box"][data-slot="banner"]').getByLabel(/^Describe the picture/).fill("A wide view of the old town");
    await shot(page, "pictures-set");
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved. Live on the site in a few seconds.");
    const row = await withLocalDb((db) => db.collection("locations").findOne({ _id: new ObjectId(first) }, { projection: { photo: 1, band: 1 } }));
    expect(row?.photo?.alt).toBe("A busy square in the evening");
    expect(row?.band?.alt).toBe("A wide view of the old town");
    await expect(page.locator('[data-tk="place-row"].is-selected img.adm-cat-thumb')).toBeVisible();
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await withLocalDb((db) => db.collection("locations").findOne({ _id: new ObjectId(first) }, { projection: { photo: 1 } })))?.photo ?? null).toBeNull();
  });

  test("Areas: add a district and a locality, rename and hide with Undo, and remove (an area with ads says to hide it)", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await signInAdminContext(context, baseURL!);
    const { first } = await seedCrowd("ar");
    const stamp = String(Date.now() % 1000000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `?place=${first}&tab=areas`);
    await expect(page.locator('[data-tk="areas-empty"]')).toBeVisible();
    await page.getByRole("button", { name: "Add district" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog.locator('[data-tk="area-error"]')).toContainText("Write a name");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`Old Town ${stamp}`);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator('[data-tk="district"]')).toHaveCount(1);
    await expect(page.locator('[data-tk="district"]')).toContainText(`Old Town ${stamp}`);
    await shot(page, "areas-district");

    await page.getByRole("button", { name: `Add locality to Old Town ${stamp}` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`Market ${stamp}`);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator('[data-tk="locality-row"]')).toHaveCount(1);

    await page.getByRole("button", { name: `Edit Old Town ${stamp}` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`Heritage ${stamp}`);
    await dialog.getByRole("checkbox", { name: "Visible on the site" }).uncheck();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page)).toContainText("is hidden");
    const district = await withLocalDb((db) => db.collection("locations").findOne({ slug: `old-town-${stamp}` }, { projection: { name: 1, enabled: 1 } }));
    expect(district).toMatchObject({ name: `Heritage ${stamp}`, enabled: false });
    await expect(page.locator('[data-tk="district-row"]')).toContainText("Hidden");
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await withLocalDb((db) => db.collection("locations").findOne({ slug: `old-town-${stamp}` }, { projection: { name: 1 } })))?.name).toBe(`Old Town ${stamp}`);

    // A district with a locality inside cannot be removed.
    await page.reload();
    await page.getByRole("button", { name: `Edit Old Town ${stamp}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove..." }).click();
    let confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`old-town-${stamp}`);
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(toast(page)).toContainText("has places inside it");
    await page.getByRole("button", { name: `Edit Market ${stamp}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove..." }).click();
    confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`market-${stamp}`);
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect.poll(async () => await withLocalDb((db) => db.collection("locations").countDocuments({ slug: `market-${stamp}` }))).toBe(0);
    await withLocalDb((db) => db.collection("listings").insertOne({ districtId: district && new ObjectId(String((district as { _id: unknown })._id)), title: "h852 ad marker", slug: `h852-marker-${stamp}`, status: "expired" }));
    await page.reload();
    await page.getByRole("button", { name: `Edit Old Town ${stamp}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove..." }).click();
    confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`old-town-${stamp}`);
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(toast(page)).toContainText("Hide it instead");

    await withLocalDb((db) => db.collection("listings").deleteMany({ slug: `h852-marker-${stamp}` }));
  });
});
