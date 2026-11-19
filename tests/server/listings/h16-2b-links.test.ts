import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adCodeOf, isAdAddressPath } from "@/lib/ad-address";
import { adHref, readPaths } from "@/lib/urls";
import { addressesFor, publicPathsOf } from "@/server/listings/ad-code";
import { Category, Listing, Location, Report } from "@/server/models";
import { fileReport } from "@/server/reports/service";
import { queryListings } from "@/server/search/query";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const owner = new mongoose.Types.ObjectId();
const paths = readPaths(undefined);

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
  const surat = await Location.create({ slug: "surat", name: "Surat", type: "city", enabled: true });
  const ad = await Listing.create({
    ownerId: owner,
    categoryId: dating._id,
    cityId: surat._id,
    title: "Coffee and Long Walks",
    slug: "coffee-and-long-walks",
    description: "A description that is long enough",
    status: "active",
    publishedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    contact: { phone: "9876543210" },
  });
  return { dating, surat, ad };
}

describe("H16.2 the link to an ad", () => {
  it("uses the address when the row has one and the old link when it does not", () => {
    expect(adHref(paths, { slug: "x-1", address: "/dating/surat/x-k7q2z/" })).toBe("/dating/surat/x-k7q2z/");
    expect(adHref(paths, { slug: "x-1" })).toBe("/ad/x-1/");
    expect(adHref(paths, { slug: "x-1", address: null })).toBe("/ad/x-1/");
  });

  it("knows an ad address from other three-part paths", () => {
    expect(isAdAddressPath("/dating/surat/coffee-and-long-walks-k7q2z/")).toBe(true);
    expect(isAdAddressPath("/dating/surat/sector-29/")).toBe(false);
    expect(isAdAddressPath("/dating/surat/")).toBe(false);
    expect(isAdAddressPath("/ad/demo-0352/")).toBe(false);
  });
});

describe("H16.2 every presented row carries its address", () => {
  it("gives cards and hits the address, so every card link, pop-out and mini card can use it", async () => {
    const { ad } = await world();
    const found = await queryListings({ categorySlug: "dating", citySlug: "surat", page: 1, pageSize: 10 });
    const expected = `/dating/surat/coffee-and-long-walks-${ad.code}/`;
    expect(found.legacy[0].address).toBe(expected);
    expect(found.hits[0].address).toBe(expected);
    expect(adHref(paths, found.legacy[0])).toBe(expected);
  });
});

describe("H16.2 addresses for lists", () => {
  it("finds addresses for many ads at once and skips ads without a code", async () => {
    const { ad, dating, surat } = await world();
    const bare = await Listing.collection.insertOne({
      ownerId: owner,
      categoryId: dating._id,
      cityId: surat._id,
      title: "No code yet",
      slug: "no-code-yet",
      description: "A description that is long enough",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const rows = await Listing.find({}).select("title categoryId cityId code slug").lean();
    const map = await addressesFor(rows);
    expect(map.get(String(ad._id))).toBe(`/dating/surat/coffee-and-long-walks-${ad.code}/`);
    expect(map.has(String(bare.insertedId))).toBe(false);
  });

  it("gives IndexNow and cache purges the address, or the old path while an ad has none", async () => {
    const { ad, dating, surat } = await world();
    await Listing.collection.insertOne({
      ownerId: owner,
      categoryId: dating._id,
      cityId: surat._id,
      title: "No code yet",
      slug: "no-code-yet",
      description: "A description that is long enough",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const rows = await Listing.find({}).select("title categoryId cityId code slug").sort({ slug: 1 }).lean();
    expect(await publicPathsOf(rows)).toEqual([`/dating/surat/coffee-and-long-walks-${ad.code}/`, "/ad/no-code-yet/"]);
  });
});

describe("H16.2 reports find an ad by its code", () => {
  it("reads the code from an address, a full link or the last part", () => {
    expect(adCodeOf("/dating/surat/coffee-and-long-walks-k7q2z/")).toBe("k7q2z");
    expect(adCodeOf("https://example.test/dating/surat/coffee-and-long-walks-k7q2z/?x=1")).toBe("k7q2z");
    expect(adCodeOf("coffee-and-long-walks-k7q2z")).toBe("k7q2z");
    expect(adCodeOf("/ad/demo-0352/")).toBe("");
    expect(adCodeOf("")).toBe("");
  });

  it("files a report for the ad that owns the code", async () => {
    const { ad } = await world();
    await fileReport({ ad: ad.code, reason: "spam", details: "Repeated posts", ip: "203.0.113.9" });
    const rows = await Report.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].listingId)).toBe(String(ad._id));
  });
});
