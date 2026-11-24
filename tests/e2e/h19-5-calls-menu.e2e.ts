import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, test, withLocalDb } from "./helpers";

const SHOTS = ".shots/H19.5";

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage: false });
}

async function userId(email: string) {
  const row = await withLocalDb((db) => db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } }));
  expect(row, "the user is in the test database").toBeTruthy();
  return row!._id as ObjectId;
}

/** A video call request on one of this vendor's ads, written straight into the test database. */
async function addRequest(vendorEmail: string, askerEmail: string) {
  const [owner, asker] = [await userId(vendorEmail), await userId(askerEmail)];
  const listing = await withLocalDb(async (db) => {
    const row = await db.collection("listings").findOne({ status: "active" }, { projection: { _id: 1 } });
    await db.collection("listings").updateOne({ _id: row!._id }, { $set: { ownerId: owner } });
    return row!._id;
  });
  await withLocalDb((db) => db.collection("video_tours").insertOne({ listingId: listing, ownerId: owner, userId: asker, coins: 10, status: "requested", requestedAt: new Date(Date.now() - 5 * 60_000), createdAt: new Date(), updatedAt: new Date() }));
  return listing;
}

test.describe("H19.5 account menu by role and the Video calls page", () => {
  test("an account that never posted sees the short menu, with Video calls and no pink bar", async ({ page, baseURL }) => {
    const { api, email } = await newUserApi(baseURL!, "menuuser");
    await api.dispose();
    await loginUi(page, email, undefined, "/u/account/calls/");
    const nav = page.locator(".up-nav-list");
    if (!isPhone(page)) {
      for (const label of ["Home", "Chats", "Video calls", "Saved ads", "Help and support", "Settings"]) await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^My ads/ })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: /^Photos and videos/ })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: /^Earnings/ })).toHaveCount(0);
    }
    await expect(page.locator("h1")).toHaveText("Video calls");
    await expect(page.locator("[data-tk=calls-empty]")).toBeVisible();
    await expect(page.locator("[data-tk=incoming-call], .tkn-call-alert")).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "calls-empty");

    // The header menu: no My ads for an account without an ad.
    await page.locator(".tkn-avatar").click();
    const menu = page.locator(".tkn-account-menu");
    await expect(menu.getByRole("menuitem", { name: /^Video calls/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^My ads/ })).toHaveCount(0);
    await expect(menu.getByRole("menuitem", { name: /^Earnings/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    await shot(page, "menu-user");
  });

  test("a vendor sees My ads and Earnings, a badge for a waiting request, and the request with Accept and Decline", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const vendor = await newUserApi(baseURL!, "menuvendor");
    const asker = await newUserApi(baseURL!, "menuasker");
    await vendor.api.dispose();
    await asker.api.dispose();
    await addRequest(vendor.email, asker.email);
    await loginUi(page, vendor.email, undefined, "/u/account/calls/");
    await expect(page.locator("[data-tk=call-row]")).toHaveCount(1);
    const row = page.locator("[data-tk=call-row]").first();
    await expect(row.locator(".tkn-call-chip")).toHaveText("Waiting");
    await expect(row).toContainText(/\d+ min left to accept/);
    await expect(row.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(row.locator("img")).toHaveCount(1);
    await expect(row.locator(".tkn-call-title")).not.toHaveText("");
    if (!isPhone(page)) {
      const nav = page.locator(".up-nav-list");
      await expect(nav.getByRole("link", { name: /^My ads/ })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^Photos and videos/ })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^Earnings/ })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^Video calls/ })).toContainText("1");
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "calls-vendor");
    // The tablet width too (the two projects are 390 and 1440).
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(await hasHorizontalScroll(page)).toBe(false);
    await shot(page, "calls-vendor");
    await page.setViewportSize(isPhone(page) ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.locator(".tkn-avatar").click();
    const menu = page.locator(".tkn-account-menu");
    await expect(menu.getByRole("menuitem", { name: /^Video calls/ })).toContainText("1");
    await expect(menu.getByRole("menuitem", { name: /^My ads/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Earnings/ })).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, "menu-vendor");
  });

  test("Recently viewed shows compact cards: a photo, one line of title and the city, no description", async ({ page }) => {
    await page.goto("/dating/bengaluru/");
    const link = page.locator("a[data-ad-link]").first();
    await link.waitFor({ state: "attached" });
    await page.goto((await link.getAttribute("href")) as string);
    await page.goto("/u/account/saved/");
    const card = page.locator("[data-tk=recent-card]").first();
    await expect(card).toBeAttached();
    expect(await card.locator("strong").count()).toBe(1);
    const box = await card.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(160);
    await expect(card.locator("p")).toHaveCount(0);
  });
});
