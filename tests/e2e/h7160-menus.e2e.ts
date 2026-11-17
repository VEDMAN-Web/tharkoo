import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, newUserApi, signInAdminContext, test, withLocalDb } from "./helpers";

/** H7.160: Menus and footer no longer edits category and city pictures (they moved), the pictures set in the new boxes reach the public pages, and the vendor tab says what is not on the site yet. */

const SHOTS = process.env.H7160_SHOTS ?? "";

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width}x${size?.height}.png`, fullPage: true });
}

test.describe("H7.160 menus pictures moved and vendor note", () => {
  test("Menus and footer points to Categories and Cities for pictures, and a picture set there shows on the public Categories page", async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);

    await page.goto("/admin/menus/");
    await page.waitForLoadState("networkidle");
    const moved = page.locator("[data-tk=pictures-moved]");
    await expect(moved).toContainText("Category and city pictures are now set in");
    await expect(moved.getByRole("link", { name: "Categories & fields" })).toHaveAttribute("href", "/admin/categories/");
    await expect(moved.getByRole("link", { name: "Cities & areas" })).toHaveAttribute("href", "/admin/locations/");
    await expect(page.getByText("Photos and listing bands")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add an image row" })).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "h7160-menus-moved");

    // A picture set in the new box wins on the public Categories page.
    const url = `/uploads/h7160-${Date.now()}.png`;
    const alt = `H7160 picture ${Date.now() % 100000}`;
    await withLocalDb((db) => db.collection("site_media").insertOne({ url, objectKey: `h7160-${Date.now()}`, alt, width: 1200, height: 800, bytes: 1000, contentType: "image/png", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() }));
    await page.goto("/admin/categories/?c=dating&tab=pictures");
    await expect(page.locator("[data-tk=picture-box]")).toHaveCount(3);
    const box = page.locator("[data-tk=picture-box]").first();
    await box.getByRole("button", { name: /Choose image|Change image/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search images").fill(alt);
    await dialog.getByTitle(alt).click();
    await box.getByRole("textbox", { name: /^Describe the picture/ }).fill("A card picture");
    await page.locator("[data-tk=save-bar]").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Saved. Live on the site in a few seconds.");
    await expect
      .poll(async () => {
        const html = await (await page.request.get("/categories/")).text();
        return html.includes(url) || html.includes(encodeURIComponent(url));
      }, { timeout: 60_000 })
      .toBe(true);
    await staff.close();
  });

  test("the Vendor tab says once that the vendor profile is not shown on the site yet", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const member = await newUserApi(baseURL!, "h7160v");
    await member.api.dispose();
    const suffix = String(Date.now()).slice(-6);
    const id = await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email: member.email.toLowerCase() });
      if (!user) return null;
      await db.collection("users").updateOne({ _id: user._id }, { $set: { displayName: `Vendor ${suffix}`, sellerProfile: { name: `Vendor ${suffix}`, city: "Pune", availableNow: false, completedAt: new Date() } } });
      return String(user._id);
    });
    expect(id).not.toBeNull();
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto(`/admin/users/?open=${id}`);
    const drawer = page.locator("[data-tk=drawer]");
    await drawer.getByRole("tab", { name: "Vendor" }).click();
    const vendor = drawer.locator("[data-tk=vendor-tab]");
    await expect(vendor.locator("[data-tk=not-shown]")).toHaveCount(1);
    await expect(vendor.locator("[data-tk=not-shown]")).toContainText("not shown on the site yet");
    await expect(vendor.getByText("Vendor profile shown")).toHaveCount(0);
    await shot(page, "h7160-vendor-note");
    await staff.close();
  });

  test("a card photo, band and phone band set for Dating show on Home and /dating/ (computer and phone), and clearing them falls back to the old row", async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    const stamp = Date.now();
    const urls = { card: `/uploads/dating-card-${stamp}.png`, band: `/uploads/dating-band-${stamp}.png`, phone: `/uploads/dating-phone-${stamp}.png`, oldCard: `/uploads/dating-old-card-${stamp}.png`, oldBand: `/uploads/dating-old-band-${stamp}.png` };
    const alts = { card: `H7161 card ${stamp % 100000}`, band: `H7161 band ${stamp % 100000}`, phone: `H7161 phone ${stamp % 100000}` };
    for (const slot of ["card", "band", "phone"] as const) {
      await withLocalDb((db) => db.collection("site_media").insertOne({ url: urls[slot], objectKey: `h7161-${slot}-${stamp}`, alt: alts[slot], width: 1200, height: 800, bytes: 1000, contentType: "image/png", tags: [], uploadedBy: "e2e@example.test", createdAt: new Date(), updatedAt: new Date() }));
    }
    // The old row (Menus and footer) that is the fallback.
    await withLocalDb((db) => db.collection("shell_config_settings").updateOne({ key: "default" }, { $set: { "config.media.images": [{ scope: "category", slug: "dating", photo: urls.oldCard, band: urls.oldBand, bandPhone: "" }] } }, { upsert: true }));
    // Start from a Dating with no pictures of its own, whatever an earlier run left.
    await withLocalDb((db) => db.collection("categories").updateOne({ slug: "dating" }, { $unset: { photo: "", band: "" } }));
    const staff = await browser.newContext({ baseURL });
    const page = await staff.newPage();
    await signInAdminContext(staff, baseURL!);
    await page.goto("/admin/categories/?c=dating&tab=pictures");
    await expect(page.locator("[data-tk=picture-box]")).toHaveCount(3);
    const box = (spot: string) => page.locator(`[data-tk=picture-box][data-slot="${spot}"]`);
    const saveBar = page.locator("[data-tk=save-bar]");
    const pick = async (spot: string, alt: string) => {
      await box(spot).getByRole("button", { name: /Choose image|Change image/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Search images").fill(alt);
      await dialog.getByTitle(alt).click();
    };
    await pick("tile", alts.card);
    await pick("banner", alts.band);
    await pick("phone", alts.phone);
    await box("tile").getByRole("textbox", { name: /^Describe the picture/ }).fill("Dating card");
    await box("banner").getByRole("textbox", { name: /^Describe the picture/ }).fill("Dating band");
    await saveBar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Saved. Live on the site in a few seconds.");

    const phone = test.info().project.name.startsWith("phone");
    const view = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined });
    const site = await view.newPage();
    await expect
      .poll(async () => {
        await site.goto("/");
        const src = await site.locator("a[href='/dating/'] img.tkh-cat-photo, a[href*='dating'] img.tkh-cat-photo").first().getAttribute("src");
        return src ?? "";
      }, { timeout: 60_000 })
      .toBe(urls.card);
    await expect
      .poll(async () => {
        await site.goto("/dating/");
        // On a phone the picture is drawn on the strip above the card (::before); on a computer on the band itself.
        return await site.locator(".tkn-ls-band").first().evaluate((el, isPhone) => getComputedStyle(el, isPhone ? "::before" : null).backgroundImage, phone);
      }, { timeout: 60_000 })
      .toContain(phone ? urls.phone : urls.band);
    const shots = process.env.H7161_SHOTS ?? "";
    if (shots) {
      const size = site.viewportSize();
      await site.screenshot({ path: `${shots}/h7161-dating-band-${size?.width}x${size?.height}.png` });
      await site.goto("/");
      await site.locator("a[href*='dating'] img.tkh-cat-photo").first().scrollIntoViewIfNeeded();
      await site.screenshot({ path: `${shots}/h7161-home-dating-tile-${size?.width}x${size?.height}.png` });
    }

    // Clearing the new pictures brings the old row back.
    for (const spot of ["tile", "banner", "phone"]) await box(spot).getByRole("button", { name: "Remove image" }).click();
    await saveBar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("[data-tk=toast]")).toContainText("Saved. Live on the site in a few seconds.");
    await expect
      .poll(async () => {
        await site.goto("/");
        return (await site.locator("a[href*='dating'] img.tkh-cat-photo").first().getAttribute("src")) ?? "";
      }, { timeout: 60_000 })
      .toBe(urls.oldCard);
    await view.close();
    await staff.close();
  });
});
