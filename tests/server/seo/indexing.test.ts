import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { shardEntries } from "@/lib/seo/sitemaps";
import { postIndexNow } from "@/server/indexnow/ping";
import { parseSubmission, recentSubmissions, submitManual } from "@/server/indexnow/manual";
import { Category, Listing, Location } from "@/server/models";
import {
  DEFAULT_INDEXING,
  NEVER,
  districtMinimum,
  getIndexing,
  hubMinimum,
  normaliseIndexing,
  saveIndexing,
  validateIndexing,
} from "@/server/seo/indexing";
import { explainUrl } from "@/server/seo/explain";
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
  delete process.env.INDEXNOW_KEY;
});

const editor = { roles: ["seo_editor"], email: "editor@example.test" };

async function seed() {
  const category = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0, fields: [], minListingsIndex: 3, minListingsLocality: 10 });
  const state = await Location.create({ type: "state", slug: "india", name: "India", parentId: null, enabled: true, order: 0 });
  const cities = [];
  for (const [slug, name] of [["pune", "Pune"], ["goa", "Goa"]] as const) {
    const city = await Location.create({ type: "city", slug, name, parentId: state._id, enabled: true, order: 0 });
    cities.push(city);
    for (let i = 0; i < 3; i++) {
      await Listing.create({
        ownerId: new mongoose.Types.ObjectId(),
        categoryId: category._id,
        stateId: state._id,
        cityId: city._id,
        title: `Office role ${slug} ${i}`,
        slug: `${slug}-role-${i}aaaa`,
        description: "A mundane office role.",
        status: "active",
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      });
    }
  }
  return { category, state, cities };
}

const cityUrls = async () => (await shardEntries("cities")).map((entry) => new URL(entry.loc).pathname).sort();

describe("indexing settings", () => {
  it("falls back to today's behaviour for empty or broken settings", () => {
    expect(normaliseIndexing(undefined)).toEqual(DEFAULT_INDEXING);
    expect(normaliseIndexing({ hub: "x", district: 0, categories: { "Bad Slug": { hub: 2 } }, offCities: ["ok", 5, "Bad Slug"] })).toEqual({ ...DEFAULT_INDEXING, offCities: ["ok"] });
    expect(hubMinimum(DEFAULT_INDEXING, { slug: "jobs", minListingsIndex: 3 })).toBe(3);
    expect(districtMinimum(DEFAULT_INDEXING, { slug: "jobs" })).toBe(10);
  });

  it("orders the minimums: category setting, site-wide setting, category field, default", () => {
    const category = { slug: "jobs", minListingsIndex: 5 };
    expect(hubMinimum(normaliseIndexing({ hub: 7 }), category)).toBe(7);
    expect(hubMinimum(normaliseIndexing({ hub: 7, categories: { jobs: { hub: 2 } } }), category)).toBe(2);
    expect(hubMinimum(DEFAULT_INDEXING, category)).toBe(5);
  });

  it("returns NEVER for a category or city that is switched off", () => {
    const off = normaliseIndexing({ categories: { jobs: { enabled: false } }, offCities: ["goa"] });
    expect(hubMinimum(off, { slug: "jobs" }, "pune")).toBe(NEVER);
    expect(hubMinimum(off, { slug: "cars" }, "goa")).toBe(NEVER);
    expect(districtMinimum(off, { slug: "cars" }, "goa")).toBe(NEVER);
    expect(hubMinimum(off, { slug: "cars" }, "pune")).toBe(3);
  });

  it("rejects bad numbers and bad slugs when saving", () => {
    expect(() => validateIndexing({ hub: 0 })).toThrow(/highlighted/);
    expect(() => validateIndexing({ hub: 5000 })).toThrow();
    expect(() => validateIndexing({ offCities: ["Not A Slug"] })).toThrow();
    expect(() => validateIndexing({ categories: { "x y": { hub: 3 } } })).toThrow();
    expect(validateIndexing({ hub: "4", district: "" }).hub).toBe(4);
  });

  it("needs an SEO role to save", async () => {
    await expect(saveIndexing({ roles: ["support"], email: "s@example.test" }, { hub: 5 })).rejects.toThrow(/SEO editor/);
  });
});

describe("indexing rules reach the sitemap and the explainer", () => {
  it("lists both cities by default", async () => {
    await seed();
    expect(await cityUrls()).toEqual(["/jobs/goa/", "/jobs/pune/"]);
  });

  it("drops a switched-off city from the sitemap and explains it as noindex", async () => {
    await seed();
    await saveIndexing(editor, { offCities: ["goa"] });
    expect(await getIndexing()).toMatchObject({ offCities: ["goa"] });
    expect(await cityUrls()).toEqual(["/jobs/pune/"]);
    const goa = await explainUrl("/jobs/goa/");
    expect(goa).toMatchObject({ indexable: false });
    expect("reasons" in goa && goa.reasons[0]).toContain("city is switched off");
    const pune = await explainUrl("/jobs/pune/");
    expect(pune).toMatchObject({ indexable: true });
  });

  it("moves pages out and back when the threshold changes", async () => {
    await seed();
    await saveIndexing(editor, { hub: 4 });
    expect(await cityUrls()).toEqual([]);
    expect(await explainUrl("/jobs/pune/")).toMatchObject({ indexable: false, reasons: ["noindex: 3 ads < minimum 4"] });
    await saveIndexing(editor, { hub: 3 });
    expect(await cityUrls()).toEqual(["/jobs/goa/", "/jobs/pune/"]);
    await saveIndexing(editor, { categories: { jobs: { hub: 2 } } });
    expect(await explainUrl("/jobs/pune/")).toMatchObject({ indexable: true });
  });

  it("drops a switched-off category from every shard", async () => {
    await seed();
    expect((await shardEntries("categories")).length).toBe(1);
    await saveIndexing(editor, { categories: { jobs: { enabled: false } } });
    expect(await shardEntries("categories")).toEqual([]);
    expect(await cityUrls()).toEqual([]);
    expect(await explainUrl("/jobs/")).toMatchObject({ indexable: false });
  });
});

describe("manual IndexNow", () => {
  it("accepts paths and addresses on this site only", () => {
    const origin = new URL(process.env.SITE_URL || "http://127.0.0.1:4317").origin;
    expect(parseSubmission(`/jobs/pune/\n${origin}/jobs/goa/#x\n\n/jobs/pune/`)).toEqual([`${origin}/jobs/pune/`, `${origin}/jobs/goa/`]);
    expect(() => parseSubmission("https://other.example/x/")).toThrow(/not addresses on this site/);
    expect(() => parseSubmission("   ")).toThrow(/at least one/);
    expect(() => parseSubmission(Array.from({ length: 101 }, (_, i) => `/p${i}/`).join("\n"))).toThrow(/At most 100/);
  });

  it("logs a dry run and makes no network call when INDEXNOW_KEY is missing", async () => {
    const result = await submitManual(editor, "/jobs/pune/");
    expect(result).toMatchObject({ urls: 1, sent: false });
    expect(result.note).toContain("not set");
    const log = await recentSubmissions();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ urls: 1, sent: false });
  });

  it("posts to IndexNow when the key is set", async () => {
    process.env.INDEXNOW_KEY = "test-key-0123456789";
    process.env.SITE_URL = "http://127.0.0.1:4317";
    let body: { urlList?: string[] } = {};
    const fake = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const out = await postIndexNow(["http://127.0.0.1:4317/jobs/pune/"], fake);
    expect(out).toEqual({ sent: true, count: 1 });
    expect(body.urlList).toEqual(["http://127.0.0.1:4317/jobs/pune/"]);
  });

  it("needs an SEO role", async () => {
    await expect(submitManual({ roles: ["support"], email: "s@example.test" }, "/jobs/pune/")).rejects.toThrow(/SEO editor/);
  });
});
