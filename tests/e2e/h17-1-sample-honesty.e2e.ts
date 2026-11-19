import type { Page } from "@playwright/test";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";
import { createLiveAd } from "./flows";

/**
 * H17.1: sample (demo) ads are honest. They show no Photo verified, no online dot, no Chat or Call or WhatsApp button (the Sample note and
 * its Post button stay); the words and meta of a listing page count the REAL ads only; a public card never shows views and clicks.
 */

const SEED_EMAIL = "seed@tharkoo.local";
const SAMPLE_LINE = "Sample ads shown until local ads are posted";

/** A category and a city where only sample ads are live, and the paths of that listing page. */
async function sampleOnlyPlace() {
  const found = await withLocalDb(async (db) => {
    const seed = await db.collection("users").findOne({ email: SEED_EMAIL }, { projection: { _id: 1 } });
    const groups = await db
      .collection("listings")
      .aggregate<{ _id: { c: ObjectId; l: ObjectId }; real: number; sample: number }>([
        { $match: { status: "active", cityId: { $exists: true }, categoryId: { $exists: true } } },
        { $group: { _id: { c: "$categoryId", l: "$cityId" }, real: { $sum: { $cond: [{ $eq: ["$ownerId", seed?._id] }, 0, 1] } }, sample: { $sum: { $cond: [{ $eq: ["$ownerId", seed?._id] }, 1, 0] } } } },
        { $match: { real: 0, sample: { $gte: 3 } } },
        { $limit: 1 },
      ])
      .toArray();
    const group = groups[0];
    if (!group) return null;
    const cat = await db.collection("categories").findOne({ _id: group._id.c }, { projection: { slug: 1, name: 1 } });
    const city = await db.collection("locations").findOne({ _id: group._id.l }, { projection: { slug: 1, name: 1 } });
    return { path: `/${cat?.slug}/${city?.slug}/`, category: String(cat?.name), city: String(city?.name) };
  });
  expect(found, "the test database has a category and a city with sample ads only").toBeTruthy();
  return found!;
}

const metaDescription = (page: Page) => page.locator('meta[name="description"]').getAttribute("content");

test.describe("H17.1 sample ads are honest", () => {
  test("a sample ad page has no verified badge, no online dot, no Chat, Call or WhatsApp button; the Sample note and its Post button stay", async ({ page }) => {
    await page.goto("/ad/demo-0352/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('[data-tk="sample-banner"]')).toBeVisible();
    await expect(page.locator('[data-tk="sample-banner"]').getByRole("link", { name: "Post an ad" })).toBeVisible();
    await expect(page.locator('[data-tk="sample-pill"]').first()).toBeVisible();
    await expect(page.locator('[data-tk="new-ad"]').getByText(/photo verified|id verified|age verified/i)).toHaveCount(0);
    await expect(page.locator(".tkn-ad-pills .is-verified, .tkn-seller-verified")).toHaveCount(0);
    await expect(page.locator('[data-tk="availability"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="bottom-bar"]')).toHaveCount(0);
    await expect(page.locator('[data-tk="call"], [data-tk="whatsapp"], [data-tk="chat"], [data-tk="tour"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /chat online now|^call|whatsapp/i })).toHaveCount(0);
    await expect(page.locator('[data-tk="new-ad"] a[href^="tel:"], [data-tk="new-ad"] a[href*="wa.me"], [data-tk="new-ad"] a[href*="whatsapp"]')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("on a listing page with sample ads only, the meta and the words say the sample line, never a count of live ads, and the cards show no views, no clicks, no verified, no online", async ({ page }) => {
    const place = await sampleOnlyPlace();
    await page.goto(place.path);
    await expect(page.locator("h1")).toHaveCount(1);
    const description = await metaDescription(page);
    expect(description, "the meta description says the sample line").toContain(SAMPLE_LINE);
    expect(description).not.toMatch(/\b\d+ live\b/i);
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/\b\d[\d,]* live (?:\w+ )?ads\b/i);
    const cards = page.locator('[data-tk="listing-row"]');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().locator('[data-tk="sample-pill"]')).toBeVisible();
    await expect(page.locator('.tk-row-stats, [data-tk="row-views"], [data-tk="row-clicks"]')).toHaveCount(0);
    await expect(cards.filter({ hasText: /\bviews?\b|\bclicks?\b/i })).toHaveCount(0);
    await expect(cards.locator('[data-tk="row-verified"]')).toHaveCount(0);
    await expect(cards.locator('[data-tk="availability"]')).toHaveCount(0);
  });

  test("on a listing page with a real ad the words count the real ads, not the sample ads", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    const ad = await createLiveAd(page, baseURL!, "h171");
    const where = await withLocalDb(async (db) => {
      const row = await db.collection("listings").findOne({ _id: new ObjectId(ad.listingId) });
      const seed = await db.collection("users").findOne({ email: SEED_EMAIL }, { projection: { _id: 1 } });
      const cat = await db.collection("categories").findOne({ _id: row?.categoryId }, { projection: { slug: 1 } });
      const city = await db.collection("locations").findOne({ _id: row?.cityId }, { projection: { slug: 1 } });
      const here = { status: "active", categoryId: row?.categoryId, cityId: row?.cityId };
      const real = await db.collection("listings").countDocuments({ ...here, ownerId: { $ne: seed?._id } });
      const all = await db.collection("listings").countDocuments(here);
      return { path: `/${cat?.slug}/${city?.slug}/`, real, all };
    });
    expect(where).toBeTruthy();
    expect(where!.real).toBeGreaterThanOrEqual(1);
    expect(where!.all, "the place also has sample ads").toBeGreaterThan(where!.real);
    await expect(async () => {
      await page.goto(where!.path);
      const description = (await metaDescription(page)) ?? "";
      expect(description).toContain(`${where!.real} live ads`);
      expect(description).not.toContain(`${where!.all} live ads`);
    }).toPass({ timeout: 90_000, intervals: [5000] });
  });
});
