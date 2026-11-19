import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

/** H16.4: the title of a live ad page, and an ended ad: 200 for 30 days with "This ad is no longer available", then 410. */

const DAY = 86_400_000;

async function copyOfAd(extra: Record<string, unknown>) {
  const slug = `h164-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ slug: { $regex: "^demo-[0-9]+$" }, status: "active" });
    const { _id, ...rest } = source!;
    void _id;
    await db.collection("listings").insertOne({ ...rest, _id: new ObjectId(), slug, title: `H164 role ${slug}`, description: "A private description that must not show on an ended page.", seoNoindex: false, ...extra });
  });
  return slug;
}

async function status(page: import("@playwright/test").Page, slug: string) {
  return (await page.goto(`/ad/${slug}/`))?.status();
}

test.describe("H16.4 ad page", () => {
  test("a live ad has the title <Ad title> in <City> - <Category> | Tharkoo", async ({ page }) => {
    test.setTimeout(180_000);
    const slug = await copyOfAd({ status: "active", expiresAt: new Date(Date.now() + 2 * DAY), publishedAt: new Date() });
    await expect.poll(() => status(page, slug), { timeout: 90_000, intervals: [2_000] }).toBe(200);
    await expect(page).toHaveTitle(/^H164 role .+ in .+ - .+ \| Tharkoo$/);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("an ad that ended yesterday answers 200 with the message and similar ads, and none of its own text; after 30 days it is 410", async ({ page }) => {
    test.setTimeout(240_000);
    const ended = await copyOfAd({ status: "expired", expiresAt: new Date(Date.now() - DAY), publishedAt: new Date(Date.now() - 4 * DAY) });
    await expect.poll(() => status(page, ended), { timeout: 90_000, intervals: [2_000] }).toBe(200);
    await expect(page.locator("h1")).toHaveText("This ad is no longer available");
    await expect(page.locator('[data-tk="ad-ended"]')).toBeVisible();
    await expect(page.locator('[data-tk="listing-row"]').first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("A private description");
    expect(await hasHorizontalScroll(page)).toBe(false);
    const old = await copyOfAd({ status: "expired", expiresAt: new Date(Date.now() - 40 * DAY), publishedAt: new Date(Date.now() - 44 * DAY) });
    await expect.poll(() => status(page, old), { timeout: 90_000, intervals: [2_000] }).toBe(410);
    const removed = await copyOfAd({ status: "removed", updatedAt: new Date(Date.now() - 2 * DAY) });
    await expect.poll(() => status(page, removed), { timeout: 90_000, intervals: [2_000] }).toBe(200);
  });
});
