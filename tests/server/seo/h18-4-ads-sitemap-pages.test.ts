import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { AD_PAGE_SIZE, adShardPage, adSitemapPages, shardEntries, sitemapIndexXml } from "@/lib/seo/sitemaps";
import { Category, Listing, Location, Site } from "@/server/models";
import { invalidateUrlCache } from "@/server/urls/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

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
  const globalForMongo = globalThis as { mongoose?: { conn: typeof mongoose; promise: Promise<typeof mongoose> } };
  globalForMongo.mongoose = { conn: mongoose, promise: Promise.resolve(mongoose) };
});

afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});

beforeEach(async () => {
  await clearMemoryMongo();
  invalidateUrlCache();
  invalidateTags(["site", "categories", "locations", "feed", "listings"]);
});

async function seed(count: number) {
  await Site.create({ key: "default", name: "Tharkoo" });
  const category = await Category.create({ slug: "juice-centers", name: "Juice Centers", enabled: true });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true });
  const city = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true });
  const ownerId = new mongoose.Types.ObjectId();
  const docs = Array.from({ length: count }, (_, i) => ({
    _id: mongoose.Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) - count + i),
    ownerId,
    categoryId: category._id,
    stateId: state._id,
    cityId: city._id,
    title: `Fresh juice stall ${i}`,
    slug: `fresh-juice-stall-${i}`,
    description: "Fresh fruit juice near the station.",
    status: "active",
    seoNoindex: false,
  }));
  await Listing.collection.insertMany(docs);
}

describe("H18.4 ads sitemap files", () => {
  it("reads ads-2 and up as ad pages, nothing else", () => {
    expect(adShardPage("ads-2")).toBe(2);
    expect(adShardPage("ads-37")).toBe(37);
    expect(adShardPage("ads-1")).toBeNull();
    expect(adShardPage("ads")).toBeNull();
    expect(adShardPage("ads-x")).toBeNull();
    expect(adShardPage("cities-2")).toBeNull();
  });

  it("lists one ads file per page in the index", () => {
    const xml = sitemapIndexXml(["categories", "ads", "content"], 3);
    expect(xml).toContain("/sitemap/ads.xml");
    expect(xml).toContain("/sitemap/ads-2.xml");
    expect(xml).toContain("/sitemap/ads-3.xml");
    expect(xml).not.toContain("/sitemap/ads-4.xml");
    expect(sitemapIndexXml(["ads"])).not.toContain("ads-2");
  });

  it("splits more than one page of ads, newest first, with none lost", async () => {
    await seed(AD_PAGE_SIZE + 5);
    expect(await adSitemapPages()).toBe(2);
    const first = await shardEntries("ads");
    const second = await shardEntries("ads", 2);
    expect(first).toHaveLength(AD_PAGE_SIZE);
    expect(second).toHaveLength(5);
    expect(first[0].loc).toContain(`fresh-juice-stall-${AD_PAGE_SIZE + 4}`);
    expect(new Set([...first, ...second].map((entry) => entry.loc)).size).toBe(AD_PAGE_SIZE + 5);
  }, 60_000);

  it("keeps one ads file when there are no ads", async () => {
    await Site.create({ key: "default", name: "Tharkoo" });
    expect(await adSitemapPages()).toBe(1);
    expect(await shardEntries("ads")).toEqual([]);
  });
});
