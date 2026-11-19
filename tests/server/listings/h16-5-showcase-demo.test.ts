import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { loadFallbackSections } from "@/lib/fallback-ads";
import { shardEntries } from "@/lib/seo/sitemaps";
import { DEMO_END_STATUS } from "@/server/listings/demo-ads";
import { DEMO_RETIRE_AT, retireDemoAdsFor, retireFullDemoPlaces } from "@/server/listings/demo-retire";
import { queryListings } from "@/server/search";
import { explainIndexability } from "@/server/seo/explain";
import { AuditEvent, Category, Listing, Location, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
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

async function world() {
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo seller", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const real = await User.create({ email: "real@example.test", displayName: "Real seller", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  const bikes = await Category.create({ slug: "bikes", name: "Bikes", enabled: true, order: 1 });
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN", enabled: true, order: 0 });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: country._id, enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
  const pune = await Location.create({ type: "city", slug: "pune", name: "Pune", parentId: state._id, enabled: true, order: 1 });
  return { seed, real, jobs, bikes, state, surat, pune };
}

let serial = 0;
async function ad(w: Awaited<ReturnType<typeof world>>, input: { owner: "seed" | "real"; category: "jobs" | "bikes"; city: "surat" | "pune"; status?: "active" | "expired"; noindex?: boolean; slug?: string }) {
  serial += 1;
  const slug = input.slug ?? (input.owner === "seed" ? `demo-${String(serial).padStart(4, "0")}` : `real-ad-${serial}-k7q2`);
  return Listing.create({
    ownerId: input.owner === "seed" ? w.seed._id : w.real._id,
    categoryId: input.category === "jobs" ? w.jobs._id : w.bikes._id,
    stateId: w.state._id,
    cityId: input.city === "surat" ? w.surat._id : w.pune._id,
    title: `${input.owner} ${input.category} ${input.city} ${serial}`,
    description: "A description that is long enough to be a real listing for this test.",
    slug,
    status: input.status ?? "active",
    seoNoindex: input.noindex ?? input.owner === "seed",
    publishedAt: new Date(Date.now() - serial * 1000),
    expiresAt: new Date(Date.now() + 3 * 86_400_000),
  });
}

describe("H16.5 every listing page is indexable and in the sitemaps", () => {
  it("lists every category, every category in every city and every city hub, with sample ads or none", async () => {
    const w = await world();
    await ad(w, { owner: "seed", category: "jobs", city: "surat" });
    const categories = (await shardEntries("categories")).map((row) => row.loc);
    expect(categories.some((url) => url.endsWith("/jobs/"))).toBe(true);
    expect(categories.some((url) => url.endsWith("/bikes/"))).toBe(true);
    const cities = (await shardEntries("cities")).map((row) => row.loc);
    for (const path of ["/jobs/surat/", "/jobs/pune/", "/bikes/surat/", "/bikes/pune/", "/jobs/gujarat/", "/bikes/gujarat/"]) {
      expect(cities.some((url) => url.endsWith(path)), path).toBe(true);
    }
    expect(cities.some((url) => url.endsWith("/cities/surat/"))).toBe(true);
  });

  it("leaves out only what the Indexing rules switch off", async () => {
    const w = await world();
    const { Site } = await import("@/server/models/cms");
    await Site.updateOne({ key: "default" }, { $set: { seoIndexing: { categories: { bikes: { enabled: false } }, offCities: ["pune"] } } }, { upsert: true });
    invalidateTags(["site"]);
    const cities = (await shardEntries("cities")).map((row) => row.loc);
    expect(cities.some((url) => url.endsWith("/jobs/surat/"))).toBe(true);
    expect(cities.some((url) => url.endsWith("/jobs/pune/"))).toBe(false);
    expect(cities.some((url) => url.endsWith("/bikes/surat/"))).toBe(false);
    expect(w.jobs).toBeTruthy();
  });

  it("the ads sitemap lists live sample ads and live real ads that are set to be indexed, not ended or noindex ones", async () => {
    const w = await world();
    const sample = await ad(w, { owner: "seed", category: "jobs", city: "surat" });
    const ended = await ad(w, { owner: "seed", category: "jobs", city: "surat", status: "expired" });
    const realIndexed = await ad(w, { owner: "real", category: "jobs", city: "surat", noindex: false });
    const realHidden = await ad(w, { owner: "real", category: "jobs", city: "surat", noindex: true });
    const urls = (await shardEntries("ads")).map((row) => row.loc);
    // H16.2: each ad is listed at its own address, which ends in the ad's code.
    const listed = (doc: { code?: string }) => urls.some((url) => url.endsWith(`-${doc.code}/`));
    expect(listed(sample)).toBe(true);
    expect(listed(realIndexed)).toBe(true);
    expect(listed(ended)).toBe(false);
    expect(listed(realHidden)).toBe(false);
  });

  it("explains a sample ad page as indexable and a listing page with no ads as indexable", () => {
    expect(explainIndexability({ pageType: "ad", demoAd: true, adNoindex: true }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "city", count: 0 }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "district", count: 1 }).indexable).toBe(true);
    expect(explainIndexability({ pageType: "city", count: 5, page: 2 }).indexable).toBe(false);
    expect(explainIndexability({ pageType: "city", count: 0, filtered: true }).indexable).toBe(false);
  });
});

describe("H16.5 sample ads are labelled, and real ads always sort first", () => {
  it("marks a demo ad as a sample and a real ad as not, and lists the real ad above the sample whatever the sort", async () => {
    const w = await world();
    const sampleNewest = await ad(w, { owner: "seed", category: "jobs", city: "surat" });
    const realOlder = await ad(w, { owner: "real", category: "jobs", city: "surat", noindex: false });
    await Listing.updateOne({ _id: sampleNewest._id }, { $set: { publishedAt: new Date(), bumpedAt: new Date() } });
    await Listing.updateOne({ _id: realOlder._id }, { $set: { publishedAt: new Date(Date.now() - 86_400_000) } });
    for (const sort of ["ranked", "fresh"] as const) {
      const result = await queryListings({ categorySlug: "jobs", citySlug: "surat", sort, page: 1, pageSize: 10 });
      expect(result.legacy.map((row) => [row.slug, row.sample]), sort).toEqual([
        [realOlder.slug, false],
        [sampleNewest.slug, true],
      ]);
    }
  });

  it("an empty category page is filled with labelled sample ads of that category from other cities", async () => {
    const w = await world();
    for (let i = 0; i < 5; i++) await ad(w, { owner: "seed", category: "bikes", city: "pune" });
    const sections = await loadFallbackSections({ scope: { categorySlug: "bikes", categoryName: "Bikes", stateSlug: "gujarat", placeName: "Surat" }, ownSlugs: [] });
    const shown = sections.flatMap((section) => section.items);
    expect(shown.length).toBeGreaterThanOrEqual(4);
    expect(shown.every((item) => item.sample === true && item.categorySlug === "bikes" && item.citySlug === "pune")).toBe(true);
  });
});

describe("H16.5 a full place ends its sample ads", () => {
  async function fill(w: Awaited<ReturnType<typeof world>>, count: number, city: "surat" | "pune" = "surat") {
    for (let i = 0; i < count; i++) await ad(w, { owner: "real", category: "jobs", city, noindex: false });
  }

  it("the 15th real ad ends that category and city's sample ads, and only those, with one system audit row", async () => {
    const w = await world();
    const here = await ad(w, { owner: "seed", category: "jobs", city: "surat" });
    const otherCity = await ad(w, { owner: "seed", category: "jobs", city: "pune" });
    const otherCategory = await ad(w, { owner: "seed", category: "bikes", city: "surat" });
    await fill(w, DEMO_RETIRE_AT - 1);
    expect(await retireDemoAdsFor({ categoryId: w.jobs._id, cityId: w.surat._id })).toBe(0);
    await fill(w, 1);
    expect(await retireDemoAdsFor({ categoryId: w.jobs._id, cityId: w.surat._id })).toBe(1);
    expect((await Listing.findById(here._id).lean())?.status).toBe(DEMO_END_STATUS);
    expect((await Listing.findById(otherCity._id).lean())?.status).toBe("active");
    expect((await Listing.findById(otherCategory._id).lean())?.status).toBe("active");
    const rows = await AuditEvent.find({ action: "listing.demo.end" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "system", targetId: "demo-ads" });
    expect((rows[0].after as { batch?: string; auto?: boolean }).auto).toBe(true);
    expect((await Listing.findById(here._id).lean())?.demoEndedBatch).toBe((rows[0].after as { batch: string }).batch);
  });

  it("does nothing when the place has no sample ads left, and a real ad never counts as a sample", async () => {
    const w = await world();
    await fill(w, DEMO_RETIRE_AT);
    expect(await retireDemoAdsFor({ categoryId: w.jobs._id, cityId: w.surat._id })).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "listing.demo.end" })).toBe(0);
    expect(await Listing.countDocuments({ status: "active" })).toBe(DEMO_RETIRE_AT);
  });

  it("the daily check ends the sample ads of every full place", async () => {
    const w = await world();
    const surat = await ad(w, { owner: "seed", category: "jobs", city: "surat" });
    const pune = await ad(w, { owner: "seed", category: "jobs", city: "pune" });
    await fill(w, DEMO_RETIRE_AT, "surat");
    await fill(w, 3, "pune");
    expect(await retireFullDemoPlaces()).toEqual({ places: 1, ended: 1 });
    expect((await Listing.findById(surat._id).lean())?.status).toBe(DEMO_END_STATUS);
    expect((await Listing.findById(pune._id).lean())?.status).toBe("active");
  });
});
