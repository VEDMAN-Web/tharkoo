import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb, withoutAddress } from "./helpers";

/**
 * H16.5: sample (demo) ads are labelled, their Chat and contact buttons show the sample message instead of contacting anyone,
 * and a listing page with no ads of its own shows labelled sample ads from other cities and "Be the first to post in <City>".
 */

const SAMPLE_PILL = '[data-tk="sample-pill"]';

async function demoCategoryAndCity() {
  return withLocalDb(async (db) => {
    const seed = await db.collection("users").findOne({ email: { $regex: "^seed" } });
    const row = await db.collection("listings").findOne({ ownerId: seed?._id, slug: { $regex: "^demo-[0-9]+$" }, status: "active" });
    const [category, city] = await Promise.all([db.collection("categories").findOne({ _id: row?.categoryId }), db.collection("locations").findOne({ _id: row?.cityId })]);
    return { category: category?.slug as string, city: city?.slug as string };
  });
}

test.describe("H16.5 sample ads", () => {
  test("a sample ad shows the Sample ad label on its card, and its page says so and answers Chat with the sample message", async ({ page }) => {
    test.setTimeout(180_000);
    const place = (await demoCategoryAndCity())!;
    await page.goto(`/${place.category}/${place.city}/`);
    const card = page.locator('[data-tk="listing-row"]', { has: page.locator(SAMPLE_PILL) }).first();
    await expect(card.locator(SAMPLE_PILL)).toHaveText("Sample ad");
    expect(await hasHorizontalScroll(page)).toBe(false);

    await card.locator("a.tkh-ad-link").first().click();
    await expect(page.locator(`[data-tk="new-ad"] ${SAMPLE_PILL}`)).toHaveText("Sample ad");
    const banner = page.locator('[data-tk="sample-banner"]');
    await expect(banner).toContainText("This is a sample ad showing how ads look on Tharkoo. Post yours free");
    await expect(banner.getByRole("link", { name: "Post an ad" })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.locator('[data-tk="chat"]:visible').first().click();
    const note = page.locator('[data-tk="sample-note"]:visible').first();
    await expect(note).toContainText("This is a sample ad showing how ads look on Tharkoo");
    await expect(note.getByRole("link", { name: "Post an ad" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.locator('[data-tk="whatsapp"]:visible').first().click();
    await expect(page.locator('[data-tk="sample-note"]:visible').first()).toBeVisible();
  });

  test("a real ad has no label and no sample message", async ({ page }) => {
    test.setTimeout(180_000);
    const slug = `h165-real-${Date.now().toString(36)}`;
    await withLocalDb(async (db) => {
      const source = await db.collection("listings").findOne({ slug: { $regex: "^demo-[0-9]+$" }, status: "active" });
      const owner = new ObjectId();
      await db.collection("users").insertOne({ _id: owner, email: `${slug}@example.test`, displayName: "H165 Seller", status: "active", roles: ["user"], createdAt: new Date() });
      const { _id: _unused, ...rest } = source!;
      void _unused;
      await db.collection("listings").insertOne({ ...withoutAddress(rest), _id: new ObjectId(), ownerId: owner, slug, title: `H165 real ad ${slug}`, seoNoindex: false });
    });
    await expect.poll(async () => (await page.goto(`/ad/${slug}/`))?.status(), { timeout: 60_000, intervals: [2_000] }).toBe(200);
    await expect(page.locator(SAMPLE_PILL)).toHaveCount(0);
    await expect(page.locator('[data-tk="sample-banner"]')).toHaveCount(0);
  });

  test("a city with no ads in a category shows labelled sample ads from other cities and Be the first to post", async ({ page }) => {
    test.setTimeout(240_000);
    const tag = Date.now().toString(36);
    const place = (await demoCategoryAndCity())!;
    const city = `h165-town-${tag}`;
    await withLocalDb(async (db) => {
      const anchor = await db.collection("locations").findOne({ type: "city" });
      await db.collection("locations").insertOne({ type: "city", slug: city, name: `H165 Town ${tag}`, parentId: anchor?.parentId, enabled: true, order: 999, createdAt: new Date(), updatedAt: new Date() });
    });
    let status = 0;
    await expect.poll(async () => (status = (await page.goto(`/${place.category}/${city}/`))?.status() ?? 0), { timeout: 120_000, intervals: [3_000] }).toBe(200);
    await expect(page.getByRole("link", { name: `Be the first to post in H165 Town ${tag}` }).first()).toBeVisible();
    const samples = page.locator(SAMPLE_PILL);
    expect(await samples.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
