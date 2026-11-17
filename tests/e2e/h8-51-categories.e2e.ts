import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H8.51: Categories & fields as one master-detail screen. */

const SHOTS = process.env.H851_SHOTS_DIR ?? "";
const TABS = ["Details", "Pictures", "Form fields", "Sub-categories"] as const;
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
    const row = await db.collection("site_media").insertOne({ url, objectKey: `h851-${Date.now()}-${Math.random()}`, alt, width: 1200, height: 800, bytes: 1000, contentType: "image/webp", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() });
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

async function open(page: Page, query = "") {
  await page.goto(`/admin/categories/${query}`);
  await expect(page.locator('[data-tk="categories-screen"]')).toBeVisible();
}

test.describe("H8.51 Categories and fields", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "sets its own sizes");
  });

  test("one screen: one list, no permanent Add form, four tabs, no sideways scroll and axe clean at 1440, 768 and 390; a phone shows the list, then the category with Back", async ({ page, context, baseURL }) => {
    test.setTimeout(420_000);
    await signInAdminContext(context, baseURL!);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Categories & fields");
      await expect(page.getByText("Add a category", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Post form fields", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Saving writes Mongo")).toHaveCount(0);
      await expect(page.locator('[data-tk="cat-list"]')).toHaveCount(1);
      expect(await page.locator('[data-tk="cat-row"]').count()).toBeGreaterThan(2);
      await expect(page.getByRole("button", { name: "New category" })).toBeVisible();
      const phone = size.width < 900;
      if (phone) {
        await expect(page.locator('[data-tk="category-detail"]')).toBeHidden();
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, "list");
        await page.locator('[data-tk="cat-row"] a').first().click();
        await expect(page.locator('[data-tk="category-detail"]')).toBeVisible();
        await expect(page.locator('[data-tk="cat-list"]')).toBeHidden();
        await expect(page.locator('[data-tk="cat-back"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-tk="category-detail"]')).toBeVisible();
        await expect(page.locator('[data-tk="cat-list"]')).toBeVisible();
        await expect(page.getByRole("button", { name: "More" })).toHaveCount(1);
        await expect(page.getByText("Shown", { exact: true })).toHaveCount(0);
      }
      for (const name of TABS) {
        await tab(page, name).click();
        await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
        if (name === "Form fields") await expect(page.locator('[data-tk="fields-tab"]')).toBeVisible();
        expect(await hasHorizontalScroll(page)).toBe(false);
        expect(await serious(page)).toEqual([]);
        await shot(page, `tab-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`);
      }
      if (phone) {
        await page.locator('[data-tk="cat-back"]').click();
        await expect(page.locator('[data-tk="cat-list"]')).toBeVisible();
        await expect(page.locator('[data-tk="category-detail"]')).toBeHidden();
      }
    }
  });

  test("Details: two columns on a computer, one on a phone, labels on top, the Kind note, the Home page line; the tab is in the address", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?tab=pictures");
    await expect(tab(page, "Pictures")).toHaveAttribute("aria-selected", "true");
    await tab(page, "Details").click();
    expect(page.url()).not.toContain("tab=pictures");
    await tab(page, "Sub-categories").click();
    expect(page.url()).toContain("tab=subs");
    await page.goBack();
    await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
    const name = page.getByRole("textbox", { name: /^Name/ });
    const address = page.getByRole("textbox", { name: /^Web address/ });
    const [a, b] = [await name.boundingBox(), await address.boundingBox()];
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);
    await expect(page.getByRole("heading", { name: "Home page" })).toBeVisible();
    await expect(page.getByLabel("Line under the name on the Home tile")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(page.url());
    const [c, d] = [await name.boundingBox(), await address.boundingBox()];
    expect(d!.y).toBeGreaterThan(c!.y + c!.height - 2);
    expect(Math.abs(d!.x - c!.x)).toBeLessThan(2);
    for (const label of ["Name", "Web address", "Kind", "Icon when there is no photo", "Max photos for admin posts and imports", "SEO intro"]) await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
  });

  test("New category dialog, then edit and save Details (the tab and address change), Kind missing shows a red note, reorder with the arrows, and Remove with a typed confirm", async ({ page, context, baseURL }) => {
    test.setTimeout(300_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const before = await page.locator('[data-tk="cat-row"]').count();
    await page.getByRole("button", { name: "New category" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New category" })).toBeVisible();
    await shot(page, "new-category-dialog");
    await dialog.getByRole("button", { name: "Create category" }).click();
    await expect(dialog.locator('[data-tk="new-cat-error"]')).toContainText("Write a name");
    const stamp = String(Date.now() % 1000000);
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`H851 Test ${stamp}`);
    await expect(dialog.getByRole("textbox", { name: /^Web address/ })).toHaveValue(`h851-test-${stamp}`);
    await dialog.getByRole("button", { name: "Create category" }).click();
    await expect(dialog.locator('[data-tk="new-cat-error"]')).toContainText("Choose a kind");
    await dialog.getByLabel(/^Kind/).selectOption("goods");
    await dialog.getByRole("button", { name: "Create category" }).click();
    await expect(page).toHaveURL(new RegExp(`c=h851-test-${stamp}`));
    await expect(page.getByRole("heading", { name: `H851 Test ${stamp}` })).toBeVisible();
    await expect(page.locator('[data-tk="cat-row"]')).toHaveCount(before + 1);

    await page.getByRole("textbox", { name: /^SEO intro/ }).fill("A short intro for search engines.");
    await page.getByLabel("Line under the name on the Home tile").fill("Things people sell near you");
    await page.getByRole("textbox", { name: /^Name/ }).fill(`H851 Renamed ${stamp}`);
    await page.getByRole("textbox", { name: /^Web address/ }).fill(`h851-renamed-${stamp}`);
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("Unsaved changes");
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved. Live on the site in a few seconds.");
    await expect(page).toHaveURL(new RegExp(`c=h851-renamed-${stamp}`));
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("Saved. Live on the site in a few seconds.");
    await expect(page.locator('[data-tk="view-category"]')).toHaveAttribute("href", `/h851-renamed-${stamp}/`);
    const saved = await withLocalDb((db) => db.collection("categories").findOne({ slug: `h851-renamed-${stamp}` }, { projection: { name: 1, introHtml: 1, description: 1, kind: 1 } }));
    expect(saved).toMatchObject({ name: `H851 Renamed ${stamp}`, introHtml: "A short intro for search engines.", description: "Things people sell near you", kind: "goods" });

    await withLocalDb((db) => db.collection("categories").updateOne({ slug: `h851-renamed-${stamp}` }, { $unset: { kind: "" } }));
    await page.reload();
    await expect(page.locator('[data-tk="kind-missing"]')).toHaveText("Choose a kind to save.");
    await expect(saveButton(page)).toBeDisabled();
    await page.getByLabel(/^Kind/).selectOption("service");
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved");
    await expect(page.locator('[data-tk="kind-missing"]')).toHaveCount(0);

    const rows = page.locator('[data-tk="cat-row"]');
    const last = rows.last();
    await expect(last).toContainText(`H851 Renamed ${stamp}`);
    const order = async () => (await withLocalDb(async (db) => (await db.collection("categories").find({ deletedAt: null }).sort({ order: 1, name: 1 }).project({ slug: 1 }).toArray()).map((row) => String(row.slug)))) ?? [];
    await page.getByRole("button", { name: `Move H851 Renamed ${stamp} up` }).click();
    await expect(toast(page)).toContainText("Order saved.");
    await expect.poll(async () => (await order()).indexOf(`h851-renamed-${stamp}`)).toBe(before - 1);
    await page.getByRole("button", { name: `Move H851 Renamed ${stamp} down` }).click();
    await expect.poll(async () => (await order()).indexOf(`h851-renamed-${stamp}`)).toBe(before);

    await page.locator("[data-tk=category-detail]").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Remove category" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`h851-renamed-${stamp}`);
    await confirm.getByRole("button", { name: "Remove category" }).click();
    await expect(page.locator('[data-tk="cat-row"]')).toHaveCount(before);
    expect(await withLocalDb((db) => db.collection("categories").countDocuments({ slug: `h851-renamed-${stamp}` }))).toBe(0);
  });

  test("a category with no kind (as Dating on the live site) shows a red note at the Kind field, not a silent grey Save", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const was = await withLocalDb(async (db) => (await db.collection("categories").findOne({ slug: "dating" }, { projection: { kind: 1 } }))?.kind as string | undefined);
    await withLocalDb((db) => db.collection("categories").updateOne({ slug: "dating" }, { $unset: { kind: "" } }));
    try {
      for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        await open(page, "?c=dating");
        await expect(page.locator('[data-tk="kind-missing"]')).toHaveText("Choose a kind to save.");
        await expect(saveButton(page)).toBeDisabled();
        await page.locator('[data-tk="kind-field"]').scrollIntoViewIfNeeded();
        await shot(page, "kind-missing");
      }
      await page.getByLabel(/^Kind/).selectOption("people");
      await expect(page.locator('[data-tk="kind-missing"]')).toHaveCount(0);
      await expect(saveButton(page)).toBeEnabled();
    } finally {
      await withLocalDb((db) => db.collection("categories").updateOne({ slug: "dating" }, was ? { $set: { kind: was } } : { $unset: { kind: "" } }));
    }
  });

  test("a category with ads cannot be removed: the screen says to hide it", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    const withAds = await withLocalDb(async (db) => {
      const ids = (await db.collection("listings").distinct("categoryId")) as ObjectId[];
      return ids.length ? ((await db.collection("categories").findOne({ _id: { $in: ids } }, { projection: { slug: 1 } }))?.slug as string | undefined) ?? null : null;
    });
    test.skip(!withAds, "Needs a category that has ads.");
    await open(page, `?c=${withAds}`);
    await page.locator("[data-tk=category-detail]").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Remove category" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(withAds!);
    await confirm.getByRole("button", { name: "Remove category" }).click();
    await expect(toast(page)).toContainText("Hide it");
    await expect(page.getByRole("heading", { name: /./, level: 2 }).first()).toBeVisible();
  });

  test("Pictures: three boxes with a drawing and one size line each, the preview, a description is needed, saving puts the picture on the public pages, Undo takes it off", async ({ page, context, baseURL }) => {
    test.setTimeout(420_000);
    const alt = `H851 picture ${Date.now() % 100000}`;
    await seedPicture(alt);
    await withLocalDb((db) => db.collection("categories").updateMany({}, { $unset: { photo: "", band: "" } }));
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?tab=pictures");
    const slug = await page.locator('[data-tk="category-detail"]').getAttribute("data-slug");
    const boxes = page.locator('[data-tk="picture-box"]');
    await expect(boxes).toHaveCount(3);
    await expect(boxes.nth(0)).toContainText("Home page tile");
    await expect(boxes.nth(0)).toContainText("Best size 1200 × 800");
    await expect(boxes.nth(1)).toContainText("Top banner for computers");
    await expect(boxes.nth(1)).toContainText("Best size 1600 × 500");
    await expect(boxes.nth(2)).toContainText("Top banner for phones (optional)");
    for (const spot of ["tile", "banner", "phone"]) await expect(page.locator(`[data-tk="where-${spot}"]`)).toBeVisible();
    await shot(page, "pictures-empty");

    await pick(page, boxes.nth(0), alt);
    await pick(page, boxes.nth(1), alt);
    await expect(boxes.nth(0).locator('[data-tk="picture-preview"]')).toBeVisible();
    await boxes.nth(0).getByRole("textbox", { name: /^Describe the picture/ }).fill("");
    await boxes.nth(1).getByRole("textbox", { name: /^Describe the picture/ }).fill("A bright street of shops");
    await saveButton(page).click();
    await expect(boxes.nth(0)).toContainText("Describe the picture in a few words");
    await boxes.nth(0).getByRole("textbox", { name: /^Describe the picture/ }).fill("A tidy flat with a balcony");
    await shot(page, "pictures-set");
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved. Live on the site in a few seconds.");
    await expect(page.locator('[data-tk="view-home"]')).toBeVisible();
    const stored = await withLocalDb((db) => db.collection("categories").findOne({ slug: slug! }, { projection: { photo: 1, band: 1 } }));
    expect(stored?.photo?.alt).toBe("A tidy flat with a balcony");
    expect(stored?.band?.alt).toBe("A bright street of shops");
    await page.locator('[data-tk="toast-undo"]').click();
    await expect.poll(async () => (await withLocalDb((db) => db.collection("categories").findOne({ slug: slug! }, { projection: { photo: 1 } })))?.photo ?? null).toBeNull();
    await page.goto(`/admin/categories/?c=${slug}&tab=pictures`);
    await pick(page, boxes.nth(0), alt);
    await pick(page, boxes.nth(1), alt);
    await boxes.nth(0).getByRole("textbox", { name: /^Describe the picture/ }).fill("A tidy flat with a balcony");
    await boxes.nth(1).getByRole("textbox", { name: /^Describe the picture/ }).fill("A bright street of shops");
    await saveButton(page).click();
    await expect(toast(page)).toContainText("Saved. Live on the site in a few seconds.");
    await expect
      .poll(async () => (await (await page.request.get("/categories/")).text()).includes("buy-and-sell%2F01.webp") || (await (await page.request.get("/categories/")).text()).includes("/placeholders/buy-and-sell/01.webp"), { timeout: 90_000, intervals: [3_000] })
      .toBe(true);
    await page.locator('[data-tk="cat-row"][data-slug="' + slug + '"] [data-tk="cat-thumb-empty"]').waitFor({ state: "detached", timeout: 30_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/categories/?c=${slug}&tab=pictures`);
    await expect(page.locator('[data-tk="picture-preview"]').first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    expect(await serious(page)).toEqual([]);
    await shot(page, "pictures-filled");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/categories/?c=${slug}&tab=pictures`);
    await shot(page, "pictures-filled");

    await withLocalDb((db) => db.collection("categories").updateOne({ slug: slug! }, { $unset: { photo: "", band: "" } }));
  });

  test("Form fields: the editor is inside the tab, its switches read On form, Filter and Required on one line, and a switch can be saved", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?tab=fields");
    const editor = page.locator('[data-tk="fields-tab"]');
    await expect(editor).toBeVisible();
    for (const word of ["On form", "Filter", "Required"]) {
      const label = editor.locator(".cf-head span", { hasText: word }).first();
      await expect(label).toBeVisible();
      const row = editor.locator(".cf-row .adm-toggle > span", { hasText: new RegExp(`^${word}$`) }).first();
      const box = await row.boundingBox();
      expect(box!.height).toBeLessThan(26);
    }
    const first = editor.locator(".cf-row").first();
    const required = first.getByRole("switch", { name: "Required" });
    const was = await required.getAttribute("aria-checked");
    await required.click();
    await expect(editor.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.locator('[data-tk="save-bar"]')).toContainText("Unsaved changes");
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expect(editor.getByText("Saved. The post-ad form and the filters now use these settings.")).toBeVisible();
    await expect(required).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
    await required.click();
    await saveButton(page).click();
    await expect(editor.getByText("Saved. The post-ad form and the filters now use these settings.")).toBeVisible();
  });

  test("Sub-categories: add one in the dialog, change it, move it, remove it", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signInAdminContext(context, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?tab=subs");
    const panel = page.locator('[data-tk="subs-tab"]');
    const before = await panel.locator('[data-tk="sub-row"]').count();
    const stamp = String(Date.now() % 100000);
    await panel.getByRole("button", { name: "Add sub-category" }).first().click();
    const dialog = page.getByRole("dialog");
    await shot(page, "sub-dialog");
    await dialog.getByRole("textbox", { name: /^Name/ }).fill(`H851 Sub ${stamp}`);
    await expect(dialog.getByRole("textbox", { name: /^Web address/ })).toHaveValue(`h851-sub-${stamp}`);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(panel.locator('[data-tk="sub-row"]')).toHaveCount(before + 1);
    await expect(panel).toContainText(`H851 Sub ${stamp}`);
    await shot(page, "subs-filled");
    await panel.getByRole("button", { name: `Edit H851 Sub ${stamp}` }).click();
    await shot(page, "sub-edit-dialog");
    await page.keyboard.press("Escape");
    await panel.getByRole("button", { name: `Edit H851 Sub ${stamp}` }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: /^Name/ }).fill(`H851 Sub ${stamp} b`);
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).toContainText(`H851 Sub ${stamp} b`);
    await panel.getByRole("button", { name: `Edit H851 Sub ${stamp} b` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove..." }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("textbox").fill(`h851-sub-${stamp}`);
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(panel.locator('[data-tk="sub-row"]')).toHaveCount(before);
  });
});
