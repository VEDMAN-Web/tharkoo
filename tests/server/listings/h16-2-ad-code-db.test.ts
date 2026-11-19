import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { backfillAdCodes, resolveAdByCode } from "@/server/listings/ad-code";
import { Category, Listing, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const owner = new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function world() {
  const dating = await Category.create({ slug: "dating", name: "Dating", enabled: true });
  const friends = await Category.create({ slug: "friends", name: "Friends", enabled: true });
  const surat = await Location.create({ slug: "surat", name: "Surat", type: "city", enabled: true });
  const pune = await Location.create({ slug: "pune", name: "Pune", type: "city", enabled: true });
  return { dating, friends, surat, pune };
}

function base(w: Awaited<ReturnType<typeof world>>, extra: Record<string, unknown> = {}) {
  return {
    ownerId: owner,
    categoryId: w.dating._id,
    cityId: w.surat._id,
    title: "Coffee and Long Walks",
    description: "A description that is long enough",
    status: "active" as "active" | "draft",
    contact: { phone: "9876543210" },
    ...extra,
  };
}

describe("H16.2 the code is saved once per ad", () => {
  it("gives a new ad a code that never changes", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { slug: "coffee-and-long-walks" }));
    expect(ad.code).toMatch(/^[a-z0-9]{5}$/);
    expect(ad.code).toMatch(/\d/);
    const first = ad.code;
    ad.title = "A different title";
    await ad.save();
    expect((await Listing.findById(ad._id))?.code).toBe(first);
  });

  it("gives every ad its own code", async () => {
    const w = await world();
    const ads = await Listing.insertMany(Array.from({ length: 400 }, (_, i) => base(w, { slug: `ad-${i}`, title: `Ad ${i}` })));
    expect(new Set(ads.map((ad) => ad.code)).size).toBe(400);
  });

  it("finds an ad by its code and nothing else", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { slug: "coffee-and-long-walks" }));
    expect((await resolveAdByCode(ad.code!))?.slug).toBe("coffee-and-long-walks");
    expect(await resolveAdByCode("zzzz9")).toBeNull();
    expect(await resolveAdByCode("not a code")).toBeNull();
  });
});

describe("H16.2 old addresses are remembered", () => {
  it("keeps the old path when the title, category or city changes", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { slug: "coffee-and-long-walks" }));
    const first = `/dating/surat/coffee-and-long-walks-${ad.code}/`;
    expect(ad.addressPath).toBe(first);
    expect(ad.previousPaths ?? []).toEqual([]);

    ad.title = "Tea and Quiet Evenings";
    await ad.save();
    ad.categoryId = w.friends._id;
    await ad.save();
    ad.cityId = w.pune._id;
    await ad.save();

    const saved = await Listing.findById(ad._id).lean();
    expect(saved?.addressPath).toBe(`/friends/pune/tea-and-quiet-evenings-${ad.code}/`);
    expect(saved?.previousPaths).toEqual([
      first,
      `/dating/surat/tea-and-quiet-evenings-${ad.code}/`,
      `/friends/surat/tea-and-quiet-evenings-${ad.code}/`,
    ]);
  });

  it("does not add a path when nothing that makes the address changed", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { slug: "coffee-and-long-walks" }));
    ad.description = "Another description that is long enough";
    await ad.save();
    expect((await Listing.findById(ad._id).lean())?.previousPaths ?? []).toEqual([]);
  });

  it("does not record a draft that has no public address yet", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { status: "draft" as const }));
    ad.title = "Changed before posting";
    await ad.save();
    const saved = await Listing.findById(ad._id).lean();
    expect(saved?.addressPath).toBeUndefined();
    expect(saved?.previousPaths ?? []).toEqual([]);
  });

  it("keeps the list small", async () => {
    const w = await world();
    const ad = await Listing.create(base(w, { slug: "many-edits" }));
    for (let i = 0; i < 25; i += 1) {
      ad.title = `Title number ${i}`;
      await ad.save();
    }
    expect((await Listing.findById(ad._id).lean())?.previousPaths?.length).toBeLessThanOrEqual(10);
  });
});

describe("H16.2 backfill for ads that have no code yet", () => {
  it("fills missing codes and address paths and leaves existing ones alone", async () => {
    const w = await world();
    const withCode = await Listing.create(base(w, { slug: "has-a-code" }));
    // Older ads were saved before the field existed: write them without the hooks.
    const old = await Listing.collection.insertOne({ ...base(w, { slug: "old-ad", title: "Old ad" }), createdAt: new Date(), updatedAt: new Date() });
    expect((await Listing.findById(old.insertedId).lean())?.code).toBeUndefined();

    const done = await backfillAdCodes(50);
    expect(done).toEqual({ filled: 1, remaining: 0 });

    const filled = await Listing.findById(old.insertedId).lean();
    expect(filled?.code).toMatch(/^[a-z0-9]{5}$/);
    expect(filled?.addressPath).toBe(`/dating/surat/old-ad-${filled?.code}/`);
    expect((await Listing.findById(withCode._id).lean())?.code).toBe(withCode.code);
    expect(await backfillAdCodes(50)).toEqual({ filled: 0, remaining: 0 });
  });

  it("works in small batches", async () => {
    const w = await world();
    for (let i = 0; i < 5; i += 1) await Listing.collection.insertOne({ ...base(w, { slug: `old-${i}`, title: `Old ${i}` }), createdAt: new Date(), updatedAt: new Date() });
    expect(await backfillAdCodes(2)).toEqual({ filled: 2, remaining: 3 });
    expect(await backfillAdCodes(10)).toEqual({ filled: 3, remaining: 0 });
  });
});
