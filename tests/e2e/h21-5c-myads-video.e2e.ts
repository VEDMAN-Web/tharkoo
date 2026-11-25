import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, hasHorizontalScroll, isPhone, loginUi, newUserApi, realAdPath, setSellerAvailable, slugFromAdPath, test, withLocalDb } from "./helpers";

/** H21.5c: the My ads "Video calls" switch (TOP and Super Top ads), and the video button on the ad page when the calls are on. */

const SHOTS = ".shots/H21.5c";

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

function tourButton(page: Page) {
  return page.locator(isPhone(page) ? "[data-tk=bottom-bar]" : "[data-tk=contact-card]").locator("[data-tk=tour]");
}

async function dbListing(slug: string) {
  return withLocalDb((db) => db.collection("listings").findOne({ slug }, { projection: { videoCallsOff: 1 } }));
}

test("My ads has a Video calls switch for a TOP ad, and the ad page shows the video button only while it is On", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const { api, email } = await newUserApi(baseURL!, "myadsvideo");
  await api.dispose();
  await loginUi(page, email);
  const path = await realAdPath(page, "/property/bengaluru/");
  const slug = slugFromAdPath(path);
  await setSellerAvailable(slug, true);
  const before = await withLocalDb((db) => db.collection("categories").findOne({ slug: "property" }, { projection: { videoTourEnabled: 1, videoTourCoins: 1 } }));
  await withLocalDb((db) => db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: true, videoTourCoins: 10 } }));
  try {
    // The ad is this account's live TOP ad.
    await withLocalDb(async (db) => {
      const user = await db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
      const listing = await db.collection("listings").findOne({ slug }, { projection: { _id: 1 } });
      const now = Date.now();
      await db.collection("listings").updateOne({ _id: listing!._id }, { $set: { ownerId: user!._id, status: "active", videoCallsOff: false, expiresAt: new Date(now + 20 * 86_400_000) } });
      const product = await db.collection("promotion_products").findOne({ code: "top" }, { projection: { _id: 1 } });
      await db.collection("promotion_orders").insertOne({ productId: product?._id, listingId: listing!._id, status: "active", startsAt: new Date(now - 3_600_000), endsAt: new Date(now + 86_400_000), createdAt: new Date(), updatedAt: new Date() });
    });

    // On: the video button is on the ad page.
    await page.goto(path);
    await expect(tourButton(page)).toBeVisible();

    await page.goto("/u/account/ads/");
    const toggle = page.locator("[data-tk=video-calls-toggle]").first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(await hasHorizontalScroll(page)).toBe(false);
    await toggle.scrollIntoViewIfNeeded();
    await shot(page, "myads-on");

    // Off: saved on the ad, the button is gone from the ad page.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toContainText("Off");
    expect((await dbListing(slug))?.videoCallsOff).toBe(true);
    await shot(page, "myads-off");
    await page.goto(path);
    await expect(page.locator("[data-tk=contact-card], [data-tk=bottom-bar]").first()).toBeAttached();
    await expect(page.locator("[data-tk=tour]")).toHaveCount(0);

    // On again.
    await page.goto("/u/account/ads/");
    const again = page.locator("[data-tk=video-calls-toggle]").first();
    await expect(again).toHaveAttribute("aria-checked", "false");
    await again.click();
    await expect(again).toHaveAttribute("aria-checked", "true");
    expect((await dbListing(slug))?.videoCallsOff).toBe(false);
    await page.goto(path);
    await expect(tourButton(page)).toBeVisible();
  } finally {
    await withLocalDb((db) => db.collection("categories").updateOne({ slug: "property" }, { $set: { videoTourEnabled: before?.videoTourEnabled === true, videoTourCoins: before?.videoTourCoins ?? 1 } }));
  }
});

test("an ad without TOP or Super Top has no Video calls switch", async ({ page, baseURL }) => {
  const { api, email } = await newUserApi(baseURL!, "myadsfree");
  await api.dispose();
  await loginUi(page, email);
  const path = await realAdPath(page, "/property/bengaluru/");
  const slug = slugFromAdPath(path);
  await withLocalDb(async (db) => {
    const user = await db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
    await db.collection("listings").updateOne({ slug }, { $set: { ownerId: user!._id, status: "active", expiresAt: new Date(Date.now() + 20 * 86_400_000) } });
  });
  await page.goto("/u/account/ads/");
  await expect(page.locator("[data-tk=promote-open]").first()).toBeVisible();
  await expect(page.locator("[data-tk=video-calls-toggle]")).toHaveCount(0);
});
