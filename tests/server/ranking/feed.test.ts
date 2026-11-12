import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { getFeed, getListingBySlug } from "@/lib/queries";
import { AuditEvent, Category, Listing, Location, PromotionOrder, PromotionProduct } from "@/server/models";
import { Site } from "@/server/models/cms";
import { addPin, previewOrder, removePin, saveRankSettings, setFeedHidden } from "@/server/ranking/admin";
import { ListingPin } from "@/server/ranking";
import { countMatching, queryListings } from "@/server/search";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { roles: ["admin"], email: "ops@example.test" };
const DAY = 86_400_000;

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});

beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

/** Three plain ads in jobs/pune (newest first: a, b, c) and one in vehicles/pune. */
async function seed() {
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0, fields: [] });
  const cars = await Category.create({ slug: "vehicles", name: "Vehicles", enabled: true, order: 1, fields: [] });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  const make = (slug: string, categoryId: mongoose.Types.ObjectId, ageDays: number, extra: Record<string, unknown> = {}) =>
    Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId,
      stateId: state._id,
      cityId: city._id,
      title: `Ad ${slug}`,
      slug,
      description: `Ad ${slug}. A mundane classified.`,
      status: "active",
      publishedAt: new Date(Date.now() - ageDays * DAY),
      ...extra,
    });
  const a = await make("ad-a-1111", jobs._id, 1);
  const b = await make("ad-b-2222", jobs._id, 2);
  const c = await make("ad-c-3333", jobs._id, 3);
  const car = await make("ad-car-4444", cars._id, 0.5);
  return { a, b, c, car, make, jobs };
}

async function promote(listingId: mongoose.Types.ObjectId, code: string) {
  const product = await PromotionProduct.create({ code, name: code, description: code, amount: 1, currency: "INR", durationDays: 7, enabled: true });
  await PromotionOrder.create({
    userId: new mongoose.Types.ObjectId(),
    listingId,
    productId: product._id,
    status: "active",
    durationDays: 7,
    startsAt: new Date(Date.now() - DAY),
    endsAt: new Date(Date.now() + DAY),
  });
}

const slugs = async (input: Parameters<typeof queryListings>[0]) => (await queryListings(input)).hits.map((hit) => hit.slug);

describe("hidden ads", () => {
  it("leave the feed and the counts but their own page still loads", async () => {
    const { b } = await seed();
    expect(await slugs({ categorySlug: "jobs" })).toEqual(["ad-a-1111", "ad-b-2222", "ad-c-3333"]);
    await setFeedHidden(admin, String(b._id), true);
    expect(await slugs({ categorySlug: "jobs" })).toEqual(["ad-a-1111", "ad-c-3333"]);
    expect(await slugs({})).not.toContain("ad-b-2222");
    expect(await countMatching({ categorySlug: "jobs" })).toBe(2);
    expect((await getFeed({ categorySlug: "jobs" })).items.map((item) => item.slug)).not.toContain("ad-b-2222");
    const page = await getListingBySlug("ad-b-2222");
    expect(page?.title).toBe("Ad ad-b-2222");
    await setFeedHidden(admin, "ad-b-2222", false);
    expect(await slugs({ categorySlug: "jobs" })).toContain("ad-b-2222");
  });
});

describe("pins", () => {
  it("moves the ad on the page it was pinned for, and nowhere else", async () => {
    const { c } = await seed();
    await addPin(admin, { scope: "hub:jobs", ref: String(c._id), position: 1 });
    expect(await slugs({ categorySlug: "jobs" })).toEqual(["ad-c-3333", "ad-a-1111", "ad-b-2222"]);
    expect((await slugs({})).indexOf("ad-c-3333")).toBeGreaterThan(0);
    expect(await slugs({ categorySlug: "vehicles" })).toEqual(["ad-car-4444"]);
    await addPin(admin, { scope: "home", ref: "http://localhost/ad/ad-car-4444/", position: 4 });
    expect((await slugs({}))[3]).toBe("ad-car-4444");
  });

  it("pins inside one district only, and a district pin does not move the city page", async () => {
    const { a, b, make, jobs } = await seed();
    const pune = await Location.findOne({ slug: "pune" });
    const kothrud = await Location.create({ type: "district", slug: "kothrud", name: "Kothrud", parentId: pune!._id, enabled: true, order: 0 });
    const inDistrict = { districtId: kothrud._id };
    const d1 = await make("ad-d1-5555", jobs._id, 5, inDistrict);
    const d2 = await make("ad-d2-6666", jobs._id, 6, inDistrict);
    const feed = { categorySlug: "jobs", citySlug: "pune", districtSlug: "kothrud" };
    expect(await slugs(feed)).toEqual(["ad-d1-5555", "ad-d2-6666"]);
    await addPin(admin, { scope: "hub:jobs/pune/kothrud", ref: String(d2._id), position: 1 });
    expect(await slugs(feed)).toEqual(["ad-d2-6666", "ad-d1-5555"]);
    expect((await slugs({ categorySlug: "jobs", citySlug: "pune" }))[0]).not.toBe("ad-d2-6666");
    await addPin(admin, { scope: "hub:jobs/pune", ref: String(b._id), position: 1 });
    expect(await slugs(feed)).toEqual(["ad-d2-6666", "ad-d1-5555"]);
    expect((await slugs({ categorySlug: "jobs", citySlug: "pune" }))[0]).toBe("ad-b-2222");
    const preview = await previewOrder(admin, "hub:jobs/pune/kothrud", undefined);
    expect(preview.map((row) => row.slug)).toEqual(["ad-d2-6666", "ad-d1-5555"]);
    expect(preview[0].pinned).toBe(true);
    expect(a).toBeTruthy();
    expect(d1).toBeTruthy();
  });

  it("ignores a pin with expired dates and one whose ad is not in that feed", async () => {
    const { c, car } = await seed();
    await ListingPin.create({ scope: "hub:jobs", listingId: String(c._id), position: 1, startsAt: new Date(Date.now() - 3 * DAY), endsAt: new Date(Date.now() - DAY), createdBy: "t" });
    await ListingPin.create({ scope: "hub:jobs", listingId: String(car._id), position: 1, createdBy: "t" });
    expect(await slugs({ categorySlug: "jobs" })).toEqual(["ad-a-1111", "ad-b-2222", "ad-c-3333"]);
  });

  it("keeps a pinned ad at the same slot across pages", async () => {
    const { c } = await seed();
    await addPin(admin, { scope: "hub:jobs", ref: String(c._id), position: 2 });
    const first = await queryListings({ categorySlug: "jobs", page: 1, pageSize: 2 });
    const second = await queryListings({ categorySlug: "jobs", page: 2, pageSize: 2 });
    expect([...first.hits, ...second.hits].map((hit) => hit.slug)).toEqual(["ad-a-1111", "ad-c-3333", "ad-b-2222"]);
  });

  it("is audited, can be removed, and validates input", async () => {
    const { c } = await seed();
    const id = await addPin(admin, { scope: "hub:jobs", ref: String(c._id), position: 1 });
    await expect(addPin(admin, { scope: "hub:jobs", ref: String(c._id), position: 1 })).rejects.toThrow(/already pinned/);
    await expect(addPin(admin, { scope: "hub:jobs", ref: "nope-nope", position: 1 })).rejects.toThrow(/No ad found/);
    await expect(addPin(admin, { scope: "elsewhere", ref: String(c._id), position: 1 })).rejects.toThrow(/page/);
    await expect(addPin(admin, { scope: "home", ref: String(c._id), position: 0 })).rejects.toThrow(/Position/);
    await expect(addPin(admin, { scope: "home", ref: String(c._id), position: 2, startsAt: "2026-02-01", endsAt: "2026-01-01" })).rejects.toThrow(/end date/);
    await removePin(admin, id);
    expect(await ListingPin.countDocuments()).toBe(0);
    const actions = (await AuditEvent.find().lean()).map((event) => event.action).sort();
    expect(actions).toEqual(["listing-order.pin.add", "listing-order.pin.remove"]);
  });
});

describe("saved settings and permissions", () => {
  it("a saved tier order is used by the feed and the change is audited", async () => {
    const { a, b } = await seed();
    await promote(a._id, "top");
    await promote(b._id, "highlight");
    expect((await slugs({ categorySlug: "jobs" })).slice(0, 2)).toEqual(["ad-a-1111", "ad-b-2222"]);
    await saveRankSettings(admin, { tierOrder: ["highlight", "top"] });
    expect((await slugs({ categorySlug: "jobs" })).slice(0, 2)).toEqual(["ad-b-2222", "ad-a-1111"]);
    const stored = await Site.findOne({ key: "default" }).lean();
    expect(stored?.ranking?.tierOrder?.slice(0, 2)).toEqual(["highlight", "top"]);
    const event = await AuditEvent.findOne({ action: "listing-order.settings.update" }).lean();
    expect(event?.after).toMatchObject({ verifiedFirst: true });
  });

  it("preview uses unsaved settings and saves nothing", async () => {
    const { a, make, jobs } = await seed();
    await promote(a._id, "top");
    const verified = await make("ad-v-6666", jobs._id, 8, { badges: ["verified"] });
    const saved = (await previewOrder(admin, "hub:jobs", undefined)).map((row) => row.slug);
    expect(saved[0]).toBe("ad-a-1111");
    const draft = await previewOrder(admin, "hub:jobs", { tierOrder: ["free", "top"], verifiedFirst: true });
    expect(draft[0]).toMatchObject({ position: 1, slug: "ad-v-6666", verified: true });
    expect(String(verified._id)).toBe(draft[0].id);
    expect(await Site.countDocuments({ ranking: { $exists: true } })).toBe(0);
    await expect(previewOrder(admin, "hub:", undefined)).rejects.toThrow(/page/);
  });

  it("refuses everyone who is not an admin", async () => {
    const { c } = await seed();
    const staff = { roles: ["moderator"], email: "mod@example.test" };
    await expect(saveRankSettings(staff, {})).rejects.toThrow(/admin/);
    await expect(addPin(staff, { scope: "home", ref: String(c._id), position: 1 })).rejects.toThrow(/admin/);
    await expect(removePin(staff, String(c._id))).rejects.toThrow(/admin/);
    await expect(setFeedHidden(staff, String(c._id), true)).rejects.toThrow(/admin/);
    await expect(previewOrder(staff, "home", undefined)).rejects.toThrow(/admin/);
    expect(await ListingPin.countDocuments()).toBe(0);
    expect(await Listing.countDocuments({ feedHidden: true })).toBe(0);
  });
});
