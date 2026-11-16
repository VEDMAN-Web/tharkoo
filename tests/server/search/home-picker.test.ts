import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { getHomeAds } from "@/lib/queries";
import { homePickerData, setHomeSelectionBatch } from "@/server/listings/home-selection";
import { AuditEvent, Category, Listing, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
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

const admin = { id: "000000000000000000000001", roles: ["admin"] };

async function seed() {
  const dating = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, fields: [], minListingsIndex: 1 });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 1, fields: [], minListingsIndex: 1 });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  const pune = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 1 });
  const make = (index: number, category: typeof dating, city: typeof pune, title: string) =>
    Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId: category._id,
      stateId: state._id,
      cityId: city._id,
      title,
      slug: `ad-${index}-aaaa${1000 + index}`,
      description: "A plain ad.",
      status: "active",
      seoNoindex: false,
      publishedAt: new Date(Date.UTC(2026, 5, 1, index)),
    });
  const ads = [];
  for (let index = 0; index < 25; index += 1) ads.push(await make(index, index % 2 ? dating : jobs, index % 3 ? pune : surat, `Plain ad ${index}`));
  ads.push(await make(30, dating, surat, "Rooftop meetup special"));
  return ads;
}

describe("homePickerData", () => {
  it("lists the 20 newest ads when there is no search, with a thumbnail field and the place", async () => {
    await seed();
    const data = await homePickerData("");
    expect(data.pinned).toEqual([]);
    expect(data.results).toHaveLength(20);
    expect(data.results[0]).toMatchObject({ show: false, order: 0 });
    expect(data.results[0].city).not.toBe("");
    expect(Object.keys(data.results[0])).toContain("thumb");
  });

  it("finds an ad by title, by city and by category, 20 results at most", async () => {
    await seed();
    expect((await homePickerData("rooftop")).results.map((row) => row.title)).toEqual(["Rooftop meetup special"]);
    const surat = await homePickerData("surat");
    expect(surat.results.length).toBeGreaterThan(0);
    expect(surat.results.every((row) => /surat/i.test(row.city))).toBe(true);
    const jobs = await homePickerData("jobs");
    expect(jobs.results.length).toBeGreaterThan(0);
    expect(jobs.results.length).toBeLessThanOrEqual(20);
    expect(jobs.results.every((row) => row.category === "jobs")).toBe(true);
    expect((await homePickerData("nothing matches this")).results).toEqual([]);
  });

  it("pins the chosen ads on top in order and leaves them out of the results", async () => {
    const ads = await seed();
    await setHomeSelectionBatch({
      items: [
        { listingId: String(ads[3]._id), show: true, order: 2 },
        { listingId: String(ads[7]._id), show: true, order: 1 },
      ],
      actor: admin,
      requestId: "r",
    });
    const data = await homePickerData("");
    expect(data.pinned.map((row) => row.id)).toEqual([String(ads[7]._id), String(ads[3]._id)]);
    expect(data.results.map((row) => row.id)).not.toContain(String(ads[3]._id));
  });
});

describe("setHomeSelectionBatch", () => {
  it("saves every changed row at once with one audit row, and Home shows them first", async () => {
    const ads = await seed();
    const saved = await setHomeSelectionBatch({
      items: [
        { listingId: String(ads[0]._id), show: true, order: 5 },
        { listingId: String(ads[1]._id), show: true, order: 1 },
        { listingId: String(ads[2]._id), show: false, order: 0 },
      ],
      actor: admin,
      requestId: "r1",
    });
    expect(saved.changed).toBe(2);
    expect(await AuditEvent.countDocuments({ action: "ad.home.update" })).toBe(1);
    const home = await getHomeAds(8);
    expect(home.slice(0, 2).map((ad) => ad.slug)).toEqual([ads[1].slug, ads[0].slug]);
    const again = await setHomeSelectionBatch({ items: [{ listingId: String(ads[1]._id), show: true, order: 1 }], actor: admin, requestId: "r2" });
    expect(again.changed).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "ad.home.update" })).toBe(1);
  });

  it("is for admins only and rejects a bad order or an unknown ad", async () => {
    const ads = await seed();
    const item = { listingId: String(ads[0]._id), show: true, order: 1 };
    await expect(setHomeSelectionBatch({ items: [item], actor: { id: admin.id, roles: ["support"] }, requestId: "r" })).rejects.toThrow(/admin/i);
    await expect(setHomeSelectionBatch({ items: [{ ...item, order: -3 }], actor: admin, requestId: "r" })).rejects.toThrow(/order/i);
    await expect(setHomeSelectionBatch({ items: [{ ...item, listingId: "000000000000000000000009" }], actor: admin, requestId: "r" })).rejects.toThrow(/not found/i);
    expect(await Listing.countDocuments({ homeShow: true })).toBe(0);
  });
});
