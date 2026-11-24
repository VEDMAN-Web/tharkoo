import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, realAdPath, signInAdminContext, test, withLocalDb } from "./helpers";

/** H21.8: the ad price is not shown or collected anywhere. The field stays in the database. */

const SHOTS = ".shots/H21.8";
const SIZES = [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;
const GONE = '[data-tk="card-price"], .tk-row-price, .tkn-ad-price, .tkn-ad-phoneprice, .tkn-alt-price, .tk-mini-ad-price';

async function shots(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    expect(await hasHorizontalScroll(page), `${name} at ${width}`).toBe(false);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
}

test.describe("H21.8 no ad price", () => {
  test("lists, the home page and a city feed show no price on any ad card", async ({ page }, testInfo) => {
    for (const path of ["/", "/property/bengaluru/", "/dating/bengaluru/", "/wellness/"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(GONE), path).toHaveCount(0);
      await expect(page.getByText("Price on request"), path).toHaveCount(0);
      expect(await page.locator("main").innerText(), path).not.toMatch(/(₹|Rs\.?)\s?\d/);
    }
    if (testInfo.project.name === "desktop-1440") {
      await page.goto("/property/bengaluru/");
      await shots(page, "list-property");
      await page.goto("/");
      await shots(page, "home");
    }
  });

  test("an ad page shows no price and its structured data has no Offer", async ({ page }, testInfo) => {
    const path = await realAdPath(page, "/property/bengaluru/");
    await page.goto(path);
    await expect(page.locator(".tkn-contact-panel")).toBeAttached();
    await expect(page.locator(GONE)).toHaveCount(0);
    await expect(page.getByText("Price on request")).toHaveCount(0);
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
    expect(ld).toContain("BreadcrumbList");
    expect(ld).not.toMatch(/"Offer"|"price"|priceCurrency/);
    const stored = await withLocalDb((db) => db.collection("listings").countDocuments({ price: { $gt: 0 } }));
    expect(stored, "the price stays in the database").not.toBeNull();
    if (testInfo.project.name === "desktop-1440") await shots(page, "ad-page");
  });

  test("the admin ad forms have no price box", async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one run is enough");
    await signInAdminContext(context, baseURL!);
    await page.goto("/admin/ads/create/");
    await expect(page.getByRole("button", { name: "Create ad" })).toBeVisible();
    await expect(page.getByText(/Price in rupees/)).toHaveCount(0);
    await shots(page, "admin-create");

    const id = await withLocalDb(async (db) => {
      const row = await db.collection("listings").findOne({ status: "active" }, { projection: { _id: 1 } });
      return row?._id.toHexString() ?? null;
    });
    if (!id) return;
    await page.goto(`/admin/ads/${id}/`);
    await expect(page.locator("#ae-title")).toBeVisible();
    await expect(page.locator("#ae-price")).toHaveCount(0);
    await expect(page.getByLabel(/^Price/)).toHaveCount(0);
    await shots(page, "admin-edit");
  });
});
