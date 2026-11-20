import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, test, withLocalDb } from "./helpers";

/** H16.4: the title of a live ad page, and an ended ad: 200 for 30 days with "This ad is no longer available", then 410. */

const DAY = 86_400_000;

async function copyOfAd(extra: Record<string, unknown>, categorySlug?: string) {
  const slug = `h164-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await withLocalDb(async (db) => {
    const category = categorySlug ? await db.collection("categories").findOne({ slug: categorySlug }) : null;
    const source = await db.collection("listings").findOne({ slug: { $regex: "^demo-[0-9]+$" }, status: "active", ...(category ? { categoryId: category._id } : {}) });
    if (!source) throw new Error(`no seeded ad${categorySlug ? ` in ${categorySlug}` : ""}`);
    // The ad code (H16.2) is unique per ad, so a copy gets none of its own until it is saved through the app.
    const { _id, code, ...rest } = source;
    void _id;
    void code;
    await db.collection("listings").insertOne({ ...rest, _id: new ObjectId(), slug, title: `H164 role ${slug}`, description: `A private description of ${slug} that must not show on an ended page.`, seoNoindex: false, ...extra });
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
    // Its own words, not the words of other copies that are live and listed as similar ads.
    await expect(page.locator("body")).not.toContainText(`A private description of ${ended}`);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const old = await copyOfAd({ status: "expired", expiresAt: new Date(Date.now() - 40 * DAY), publishedAt: new Date(Date.now() - 44 * DAY) });
    await expect.poll(() => status(page, old), { timeout: 90_000, intervals: [2_000] }).toBe(410);
    const removed = await copyOfAd({ status: "removed", updatedAt: new Date(Date.now() - 2 * DAY) });
    await expect.poll(() => status(page, removed), { timeout: 90_000, intervals: [2_000] }).toBe(200);
  });

  test("structured data: a real goods ad is a Product with an Offer; a people ad and a sample ad carry no Offer, Product or JobPosting", async ({ request }) => {
    test.setTimeout(240_000);
    const nodesOf = async (path: string) => {
      const html = await (await request.get(path)).text();
      const out: Array<Record<string, unknown>> = [];
      for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
        const parsed = JSON.parse(match[1] ?? "null") as Record<string, unknown> | Array<Record<string, unknown>>;
        out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      }
      return out;
    };
    const types = (nodes: Array<Record<string, unknown>>) => nodes.map((node) => String(node["@type"]));
    const goods = await copyOfAd({ status: "active", expiresAt: new Date(Date.now() + 2 * DAY), publishedAt: new Date(), attributes: { price: 4500 } }, "buy-and-sell");
    await expect.poll(async () => (await request.get(`/ad/${goods}/`)).status(), { timeout: 90_000, intervals: [2_000] }).toBe(200);
    const goodsNodes = await nodesOf(`/ad/${goods}/`);
    expect(types(goodsNodes)).toContain("Product");
    expect(JSON.stringify(goodsNodes)).toContain('"@type":"Offer"');
    const people = await copyOfAd({ status: "active", expiresAt: new Date(Date.now() + 2 * DAY), publishedAt: new Date(), attributes: { price: 4500 } }, "dating");
    await expect.poll(async () => (await request.get(`/ad/${people}/`)).status(), { timeout: 90_000, intervals: [2_000] }).toBe(200);
    const peopleText = JSON.stringify(await nodesOf(`/ad/${people}/`));
    for (const word of ['"Offer"', '"Product"', '"JobPosting"', '"Service"', '"RealEstateListing"', "aggregateRating"]) expect(peopleText, `people ad: ${word}`).not.toContain(word);
    const sample = await withLocalDb((db) => db.collection("listings").findOne({ status: "active", slug: { $regex: "^demo-[0-9]+$" } }, { projection: { slug: 1 } }));
    const sampleText = JSON.stringify(await nodesOf(`/ad/${sample?.slug}/`));
    for (const word of ['"Offer"', '"Product"', '"JobPosting"', '"Service"', '"RealEstateListing"']) expect(sampleText, `sample ad: ${word}`).not.toContain(word);
  });
});
