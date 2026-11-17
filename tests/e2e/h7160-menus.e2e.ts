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
    await page.goto("/admin/categories/?tab=pictures");
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

  test("the Vendor tab says three times that the vendor profile is not shown on the site yet", async ({ browser, baseURL }) => {
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
    await expect(vendor.locator("[data-tk=not-shown]")).toHaveCount(3);
    await expect(vendor.locator("[data-tk=not-shown]").first()).toHaveText("Not shown on the site yet.");
    await shot(page, "h7160-vendor-note");
    await staff.close();
  });
});
