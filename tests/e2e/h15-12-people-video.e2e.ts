import AxeBuilder from "@axe-core/playwright";
import { ObjectId } from "mongodb";
import { expect, hasHorizontalScroll, signInAdminContext, test, withLocalDb } from "./helpers";

/** H15.12: All ads can show "People ads with a video" so staff can find clips that slipped in before the rule. It only looks; nothing is changed. */

async function seed(tag: string) {
  return withLocalDb(async (db) => {
    const people = await db.collection("categories").findOne({ slug: "dating" });
    const goods = await db.collection("categories").findOne({ slug: { $ne: "dating" }, kind: { $ne: "people" } });
    const owner = new ObjectId();
    await db.collection("users").insertOne({ _id: owner, email: `${tag}@example.test`, displayName: `H1512 Seller ${tag}`, status: "active", roles: ["user"], createdAt: new Date() });
    const base = { ownerId: owner, description: "A description that is long enough for the rules.", status: "active", expiresAt: new Date(Date.now() + 3 * 86_400_000), publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
    const peopleWithVideo = { _id: new ObjectId(), ...base, categoryId: people!._id, title: `H1512 ${tag} people with video`, slug: `h1512-${tag}-people-video` };
    const peopleBare = { _id: new ObjectId(), ...base, categoryId: people!._id, title: `H1512 ${tag} people without video`, slug: `h1512-${tag}-people-bare` };
    const goodsWithVideo = { _id: new ObjectId(), ...base, categoryId: goods!._id, title: `H1512 ${tag} goods with video`, slug: `h1512-${tag}-goods-video` };
    await db.collection("listings").insertMany([peopleWithVideo, peopleBare, goodsWithVideo]);
    const clip = (listingId: ObjectId) => ({ ownerId: owner, listingId, kind: "video", objectKey: `/uploads/${new ObjectId()}.mp4`, status: "cleared", createdAt: new Date(), updatedAt: new Date() });
    await db.collection("media_assets").insertMany([clip(peopleWithVideo._id), clip(goodsWithVideo._id)]);
    return { withVideo: peopleWithVideo.title, bare: peopleBare.title, goods: goodsWithVideo.title };
  });
}

test.describe("H15.12 People ads with a video", () => {
  test("the filter lists only people ads that have a video, fits the screen, and changes nothing", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await signInAdminContext(context, baseURL!);
    const tag = `t${Date.now().toString(36)}`;
    const ads = (await seed(tag))!;

    await page.goto(`/admin/ads/?q=${encodeURIComponent(`H1512 ${tag}`)}`, { waitUntil: "networkidle" });
    const rows = page.locator('[data-tk="ads-screen"] tbody tr');
    await expect(rows).toHaveCount(3);

    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "People ads with a video" }).click();
    await expect(page).toHaveURL(/pvideo=1/);
    await expect(page.locator('[data-tk="filter-chip"]')).toContainText("People ads with a video");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(ads.withVideo);
    await expect(page.getByText(ads.bare)).toHaveCount(0);
    await expect(page.getByText(ads.goods)).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
    const serious = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
    expect(serious.map((item) => item.id)).toEqual([]);

    const statuses = await withLocalDb((db) => db.collection("listings").find({ title: { $regex: `^H1512 ${tag}` } }).project({ status: 1 }).toArray());
    expect(statuses!.map((row) => row.status)).toEqual(["active", "active", "active"]);

    await page.getByRole("button", { name: "Remove filter People ads with a video" }).click();
    await expect(page).not.toHaveURL(/pvideo=1/);
    await expect(rows).toHaveCount(3);
  });
});
