import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { legacyAdRedirect, resolveAdAddress } from "@/server/listings/ad-route";
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
  await Location.create({ slug: "sector-29", name: "Sector 29", type: "district", parentId: surat._id, enabled: true });
  const ad = await Listing.create({
    ownerId: owner,
    categoryId: dating._id,
    cityId: surat._id,
    title: "Coffee and Long Walks",
    slug: "coffee-and-long-walks",
    description: "A description that is long enough",
    status: "active",
    contact: { phone: "9876543210" },
  });
  return { dating, friends, surat, pune, ad };
}

describe("H16.2 /<category>/<city>/<x>/", () => {
  it("shows the ad at its own address", async () => {
    const { ad } = await world();
    expect(await resolveAdAddress("dating", "surat", `coffee-and-long-walks-${ad.code}`)).toEqual({ slug: "coffee-and-long-walks" });
  });

  it("forwards a wrong title part, category or city to the right address", async () => {
    const { ad } = await world();
    const right = `/dating/surat/coffee-and-long-walks-${ad.code}/`;
    expect(await resolveAdAddress("dating", "surat", `old-title-${ad.code}`)).toEqual({ redirect: right });
    expect(await resolveAdAddress("friends", "surat", `coffee-and-long-walks-${ad.code}`)).toEqual({ redirect: right });
    expect(await resolveAdAddress("dating", "pune", `coffee-and-long-walks-${ad.code}`)).toEqual({ redirect: right });
    expect(await resolveAdAddress("nonsense", "nowhere", `coffee-and-long-walks-${ad.code}`)).toEqual({ redirect: right });
  });

  it("forwards every earlier address after the title, category and city change", async () => {
    const { ad, friends, pune } = await world();
    const before = `coffee-and-long-walks-${ad.code}`;
    ad.title = "Tea and Quiet Evenings";
    ad.categoryId = friends._id;
    ad.cityId = pune._id;
    await ad.save();
    const right = `/friends/pune/tea-and-quiet-evenings-${ad.code}/`;
    expect(await resolveAdAddress("dating", "surat", before)).toEqual({ redirect: right });
    expect((await Listing.findById(ad._id).lean())?.previousPaths).toContain(`/dating/surat/${before}/`);
  });

  it("serves a known area first, even next to ads", async () => {
    await world();
    expect(await resolveAdAddress("dating", "surat", "sector-29")).toBeNull();
    expect(await resolveAdAddress("dating", "surat", "sector-30")).toBeNull();
  });

  it("is not an ad when the code is unknown, or the part has no code", async () => {
    await world();
    expect(await resolveAdAddress("dating", "surat", "coffee-and-long-walks-zzzz9")).toBeNull();
    expect(await resolveAdAddress("dating", "surat", "coffee-and-long-walks")).toBeNull();
  });

  it("is not an ad when the ad was removed", async () => {
    const { ad } = await world();
    await Listing.updateOne({ _id: ad._id }, { $set: { status: "removed" } });
    expect(await resolveAdAddress("dating", "surat", `coffee-and-long-walks-${ad.code}`)).toBeNull();
  });
});

describe("H16.2 old /ad/<slug>/ link", () => {
  it("points at the new address", async () => {
    const { ad } = await world();
    expect(await legacyAdRedirect("coffee-and-long-walks")).toBe(`/dating/surat/coffee-and-long-walks-${ad.code}/`);
  });

  it("gives an older ad its code the first time its old link is opened", async () => {
    const { dating, surat } = await world();
    await Listing.collection.insertOne({
      ownerId: owner,
      categoryId: dating._id,
      cityId: surat._id,
      title: "Old ad",
      slug: "old-ad",
      description: "A description that is long enough",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const to = await legacyAdRedirect("old-ad");
    const saved = await Listing.findOne({ slug: "old-ad" }).lean();
    expect(saved?.code).toMatch(/^[a-z0-9]{5}$/);
    expect(to).toBe(`/dating/surat/old-ad-${saved?.code}/`);
    expect(await legacyAdRedirect("old-ad")).toBe(to);
  });

  it("has no new address for an ad that is gone or unknown", async () => {
    const { ad } = await world();
    expect(await legacyAdRedirect("nothing-here")).toBeNull();
    await Listing.updateOne({ _id: ad._id }, { $set: { status: "removed" } });
    expect(await legacyAdRedirect("coffee-and-long-walks")).toBeNull();
  });
});
