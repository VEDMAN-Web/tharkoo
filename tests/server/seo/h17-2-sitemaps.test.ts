import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { revalidate as adRevalidate } from "@/app/ad/[slug]/page";
import { revalidate as categoryRevalidate } from "@/app/[category]/page";
import { revalidate as districtRevalidate } from "@/app/[category]/[location]/[district]/page";
import { revalidate as locationRevalidate } from "@/app/[category]/[location]/page";
import { invalidateTags } from "@/lib/cache";
import { shardEntries, sitemapXml } from "@/lib/seo/sitemaps";
import { Category, Listing, Location, Page, User } from "@/server/models";
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

const D1 = new Date("2026-03-01T10:00:00.000Z");
const D2 = new Date("2026-04-02T11:00:00.000Z");
const D3 = new Date("2026-05-03T12:00:00.000Z");

async function world() {
  const owner = await User.create({ email: "o@example.test", displayName: "O", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: null, enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
  await Category.collection.updateOne({ _id: jobs._id }, { $set: { updatedAt: D1 } });
  await Location.collection.updateOne({ _id: state._id }, { $set: { updatedAt: D2 } });
  await Location.collection.updateOne({ _id: surat._id }, { $set: { updatedAt: D2 } });
  const ad = await Listing.create({ ownerId: owner._id, categoryId: jobs._id, stateId: state._id, cityId: surat._id, title: "Office role", description: "A description that is long enough.", slug: "office-role-k7q2", status: "active", seoNoindex: false, publishedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date(Date.now() + 86_400_000) });
  await Listing.collection.updateOne({ _id: ad._id }, { $set: { updatedAt: D3 } });
  return { jobs, state, surat, ad };
}

const find = (rows: { loc: string; lastmod?: string }[], tail: string) => rows.find((row) => row.loc.endsWith(tail));

describe("H17.2 sitemap lastmod is the record's real date", () => {
  it("omits lastmod instead of making one up", () => {
    const xml = sitemapXml([{ loc: "https://tharkoo.example/a/" }, { loc: "https://tharkoo.example/b/", lastmod: "2026-01-01T00:00:00.000Z" }]);
    expect(xml).toContain("<url><loc>https://tharkoo.example/a/</loc></url>");
    expect(xml).toContain("<url><loc>https://tharkoo.example/b/</loc><lastmod>2026-01-01T00:00:00.000Z</lastmod></url>");
    expect((xml.match(/<lastmod>/g) ?? []).length).toBe(1);
  });

  it("category, state, city and ad pages carry the date of their own records", async () => {
    await world();
    const categories = await shardEntries("categories");
    expect(find(categories, "/jobs/")?.lastmod).toBe(D1.toISOString());
    const cities = await shardEntries("cities");
    expect(find(cities, "/jobs/gujarat/")?.lastmod).toBe(D2.toISOString());
    expect(find(cities, "/cities/surat/")?.lastmod).toBe(D2.toISOString());
    expect(find(cities, "/jobs/surat/")?.lastmod).toBe(D3.toISOString());
    const ads = await shardEntries("ads");
    expect(find(ads, "/office-role-k7q2/")?.lastmod).toBe(D3.toISOString());
  });

  it("a page with no real date has no lastmod: the fixed pages never get today's date", async () => {
    await world();
    const content = await shardEntries("content");
    expect(content.length).toBeGreaterThan(5);
    for (const row of content.filter((entry) => /\/(terms|privacy|cookies|contact|safety)\/$/.test(entry.loc) || entry.loc.endsWith("tharkoo.example/") || /\/$/.test(entry.loc))) {
      if (!/\/(blog|help|cms)\/[^/]+\/$/.test(row.loc)) expect(row.lastmod, row.loc).toBeUndefined();
    }
  });

  it("a published page shows its own updated date", async () => {
    await Page.create({ slug: "about-us", title: "About us", status: "published", body: "x" });
    await Page.collection.updateOne({ slug: "about-us" }, { $set: { updatedAt: D2 } });
    const content = await shardEntries("content");
    expect(find(content, "/about-us/")?.lastmod).toBe(D2.toISOString());
  });
});

describe("H17.2 listing and ad pages are cached for about five minutes", () => {
  it("the ad page, the location page, the district page and the category page revalidate every 300 s", () => {
    expect([adRevalidate, locationRevalidate, districtRevalidate, categoryRevalidate]).toEqual([300, 300, 300, 300]);
  });
});
