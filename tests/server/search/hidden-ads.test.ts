import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as searchGet } from "@/app/api/search/route";
import { invalidateTags } from "@/lib/cache";
import { getLatestListings, getListingBySlug, getRelated, listingCountsByCategoryCity, searchListings } from "@/lib/queries";
import { shardEntries } from "@/lib/seo/sitemaps";
import { Category, Listing, Location } from "@/server/models";
import { queryListings } from "@/server/search";
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

async function seed() {
  const category = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0, fields: [], minListingsIndex: 1 });
  const state = await Location.create({ type: "state", slug: "maharashtra", name: "Maharashtra", parentId: null, enabled: true, order: 0 });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 0 });
  const make = (slug: string, feedHidden: boolean) =>
    Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId: category._id,
      stateId: state._id,
      cityId: city._id,
      title: `Office role ${slug}`,
      slug,
      description: "A mundane office role.",
      status: "active",
      feedHidden,
      seoNoindex: false,
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    });
  await make("shown-role-aaaa1111", false);
  await make("hidden-role-bbbb2222", true);
}

describe("hidden ads stay out of public lists", () => {
  it("excludes them from search, feeds, related, latest, counts and the ads sitemap", async () => {
    await seed();
    const feed = await queryListings({ categorySlug: "jobs", citySlug: "pune", page: 1, pageSize: 20 });
    expect(feed.legacy.map((row) => row.slug)).toEqual(["shown-role-aaaa1111"]);

    const text = await queryListings({ q: "office", page: 1, pageSize: 20 });
    expect(text.legacy.map((row) => row.slug)).toEqual(["shown-role-aaaa1111"]);

    const legacy = await searchListings({ q: "office" } as never).catch(() => null);
    if (legacy) expect(JSON.stringify(legacy)).not.toContain("hidden-role");

    const api = await searchGet(new Request("http://localhost/api/search?q=office"));
    expect(JSON.stringify(await api.json())).not.toContain("hidden-role");

    const shown = await getListingBySlug("shown-role-aaaa1111");
    const related = await getRelated(shown as never, 6);
    expect(JSON.stringify(related)).not.toContain("hidden-role");

    expect((await getLatestListings(12)).map((row) => row.slug)).toEqual(["shown-role-aaaa1111"]);
    const counts = await listingCountsByCategoryCity();
    expect(counts[0]?.n).toBe(1);

    const ads = await shardEntries("ads");
    const urls = ads.map((row) => row.loc).join(" ");
    expect(urls).toContain("shown-role-aaaa1111");
    expect(urls).not.toContain("hidden-role");
  });

  it("still serves a hidden ad by its own slug", async () => {
    await seed();
    const hidden = await getListingBySlug("hidden-role-bbbb2222");
    expect(hidden?.slug).toBe("hidden-role-bbbb2222");
  });
});
