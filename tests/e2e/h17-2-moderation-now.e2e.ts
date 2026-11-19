import { ObjectId } from "mongodb";
import { expect, loginApi, loginUi, newApi, originHeaders, registerApi, setRoles, test, uniqueEmail, withLocalDb } from "./helpers";

/**
 * H17.2: pages are stored for 300 seconds, but a moderation change must show on the very next request.
 * Production build: an ad that is removed, paused or deleted answers 410 (or leaves the page) at once and is gone
 * from its city page, its category page and the home page on the next request.
 */

type Placed = { id: ObjectId; slug: string; title: string; category: string; city: string };

// Each test uses a category and a city that no earlier test read, so no kept copy of a list hides a row put straight into the database.
const used: { categories: unknown[]; cities: unknown[] } = { categories: [], cities: [] };

async function placeAd(label: string, ownerId: ObjectId): Promise<Placed | null> {
  return withLocalDb(async (db) => {
    const source = await db.collection("listings").findOne({ status: "active", slug: { $regex: "^demo-" }, categoryId: { $nin: used.categories as never[] }, cityId: { $nin: used.cities as never[] } });
    if (!source) throw new Error("no seeded ad in an unused category and city");
    used.categories.push(source.categoryId);
    used.cities.push(source.cityId);
    const category = await db.collection("categories").findOne({ _id: source.categoryId });
    const city = await db.collection("locations").findOne({ _id: source.cityId });
    const { _id, lastModerationAt, ...rest } = source as Record<string, unknown> & { _id: ObjectId; lastModerationAt?: Date };
    void _id;
    void lastModerationAt;
    const stamp = Date.now();
    const slug = `h172-${label}-${stamp}`;
    const title = `Zqh172${label}x${stamp}`;
    const now = new Date();
    const row = await db.collection("listings").insertOne({ ...rest, ownerId, title, slug, status: "active", sample: false, publishedAt: now, createdAt: now, updatedAt: now, expiresAt: new Date(stamp + 3 * 86_400_000) });
    return { id: row.insertedId, slug, title, category: String(category?.slug), city: String(city?.slug) };
  });
}

async function pages(request: import("@playwright/test").APIRequestContext, ad: Placed) {
  const [city, category, home] = await Promise.all([request.get(`/${ad.category}/${ad.city}/`), request.get(`/${ad.category}/`), request.get("/")]);
  return { city: await city.text(), category: await category.text(), home: await home.text() };
}

test.describe("H17.2 a moderation change shows at once", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "answers are the same at every size");
  });

  test("admin removes an ad: 410 on the next request, gone from its city, category and home pages", async ({ page, request, baseURL }) => {
    test.setTimeout(240_000);
    const staff = uniqueEmail("h172mod");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, staff);
    await api.dispose();
    test.skip(!(await setRoles(staff, ["moderator"])), "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const owner = new ObjectId();
    await withLocalDb((db) => db.collection("users").insertOne({ _id: owner, email: `h172-owner-${Date.now()}@example.test`, displayName: "H172 Seller", status: "active", roles: ["user"], createdAt: new Date() }));
    // The moderation screen lists ads published since "check ads after they go live" was turned on (as the A18 spec sets it).
    await withLocalDb((db) => db.collection("sites").updateMany({}, { $set: { postModerationSince: new Date(Date.now() - 86_400_000) } }));
    const ad = await placeAd("remove", owner);
    expect(ad).toBeTruthy();
    const placed = ad as Placed;

    // The ad is stored and shown: warm every page that carries it.
    expect((await request.get(`/ad/${placed.slug}/`)).status()).toBe(200);
    expect((await request.get(`/ad/${placed.slug}/`)).status()).toBe(200);
    // A row put in the database directly shows once the list is read again (the list is kept for a minute); the change under test is what comes after.
    await expect.poll(async () => (await pages(request, placed)).city, { timeout: 40_000, intervals: [2_000], message: "the city page shows the ad before it is removed" }).toContain(placed.title);

    await loginUi(page, staff, undefined, "/admin/moderation/");
    const row = page.locator("tr, li, article").filter({ hasText: placed.title }).getByRole("button", { name: "Remove ad..." }).first();
    await expect(row).toBeVisible();
    await row.click();
    const dialog = page.locator('[data-tk="reason-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Breaks the posting rules").check();
    await dialog.getByRole("button", { name: "Remove ad" }).click();
    await expect(page.getByText(/removed\./).first()).toBeVisible();

    // The very next requests: no waiting, no second try.
    const gone = await request.get(`/ad/${placed.slug}/`);
    expect(gone.status(), "the ad page").toBe(410);
    const after = await pages(request, placed);
    expect(after.city, "the city page").not.toContain(placed.title);
    expect(after.category, "the category page").not.toContain(placed.title);
    expect(after.home, "the home page").not.toContain(placed.title);
  });

  test("a seller pauses an ad and then deletes it: gone from the pages on the next request each time", async ({ request, baseURL }) => {
    test.setTimeout(240_000);
    const email = uniqueEmail("h172seller");
    const api = await newApi(baseURL!);
    await registerApi(api, baseURL!, email);
    await loginApi(api, baseURL!, email);
    const user = await withLocalDb((db) => db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } }));
    test.skip(!user, "Needs the in-memory Mongo URI written by tests/e2e/server.mjs (E2E_MONGO_URI_FILE).");
    const placed = (await placeAd("seller", user!._id as ObjectId)) as Placed;

    expect((await request.get(`/ad/${placed.slug}/`)).status()).toBe(200);
    await expect.poll(async () => (await pages(request, placed)).city, { timeout: 40_000, intervals: [2_000], message: "the city page shows the ad before it is paused" }).toContain(placed.title);

    const paused = await api.post(`/api/listings/${placed.id}/pause`, { headers: originHeaders(baseURL!) });
    expect(paused.status(), await paused.text()).toBe(200);
    expect((await request.get(`/ad/${placed.slug}/`)).status(), "a paused ad's page is not shown").not.toBe(200);
    const afterPause = await pages(request, placed);
    expect(afterPause.city, "paused: the city page").not.toContain(placed.title);
    expect(afterPause.category, "paused: the category page").not.toContain(placed.title);
    expect(afterPause.home, "paused: the home page").not.toContain(placed.title);

    const resumed = await api.post(`/api/listings/${placed.id}/resume`, { headers: originHeaders(baseURL!) });
    expect(resumed.status(), await resumed.text()).toBe(200);
    expect((await pages(request, placed)).city, "resumed: back on the city page at once").toContain(placed.title);

    const deleted = await api.delete(`/api/listings/${placed.id}`, { headers: originHeaders(baseURL!) });
    expect(deleted.status(), await deleted.text()).toBe(200);
    expect((await request.get(`/ad/${placed.slug}/`)).status(), "deleted: the ad page").toBe(410);
    const afterDelete = await pages(request, placed);
    expect(afterDelete.city, "deleted: the city page").not.toContain(placed.title);
    expect(afterDelete.category, "deleted: the category page").not.toContain(placed.title);
    expect(afterDelete.home, "deleted: the home page").not.toContain(placed.title);
    await api.dispose();
  });
});
