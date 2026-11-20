import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { fallbackLanding } from "@/lib/seo/landing";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { queryListings } from "@/server/search";
import { Category, Listing, Location, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H17.1: a sample (demo) ad carries no trust marks and no verified badge, and the numbers of a page count the real ads only. */

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
  const user = { passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() };
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo seller", ...user });
  const real = await User.create({ email: "real@example.test", displayName: "Real seller", ...user });
  // Both owners are ID-approved: the sample ad must still carry no trust mark.
  await User.updateMany({ _id: { $in: [seed._id, real._id] } }, { $set: { verificationStatus: "approved" } });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN", enabled: true, order: 0 });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: country._id, enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
  return { seed, real, jobs, state, surat };
}

let serial = 0;
async function ad(w: Awaited<ReturnType<typeof world>>, owner: "seed" | "real") {
  serial += 1;
  return Listing.create({
    ownerId: owner === "seed" ? w.seed._id : w.real._id,
    categoryId: w.jobs._id,
    stateId: w.state._id,
    cityId: w.surat._id,
    title: `${owner} jobs surat ${serial}`,
    description: "A description that is long enough to be a real listing for this test.",
    slug: owner === "seed" ? `demo-${String(serial).padStart(4, "0")}` : `real-ad-${serial}-k7q2`,
    status: "active",
    badges: ["verified"],
    publishedAt: new Date(Date.now() - serial * 1000),
    expiresAt: new Date(Date.now() + 3 * 86_400_000),
  });
}

describe("H17.1 sample ads are not verified, and the count is the real ads", () => {
  it("a sample ad has no verified badge and no trust marks even when its owner is approved and the ad is marked verified; a real ad keeps them", async () => {
    const w = await world();
    await ad(w, "seed");
    await ad(w, "real");
    const result = await queryListings({ categorySlug: "jobs", citySlug: "surat" });
    const sample = result.legacy.find((item) => item.sample);
    const real = result.legacy.find((item) => !item.sample);
    expect(sample, "the sample ad is in the list").toBeTruthy();
    expect(sample?.verified).toBe(false);
    expect(sample?.trust).toEqual([]);
    expect(real?.verified).toBe(true);
    expect(real?.trust).toContain("ID verified");
    expect(result.hits.find((hit) => hit.slug === sample?.slug)?.verified).toBe(false);
  });

  it("realTotal counts the real ads only, and is 0 when only sample ads are shown", async () => {
    const w = await world();
    await ad(w, "seed");
    await ad(w, "seed");
    const onlySamples = await queryListings({ categorySlug: "jobs", citySlug: "surat" });
    expect(onlySamples).toMatchObject({ total: 2, realTotal: 0 });
    await ad(w, "real");
    invalidateTags(["listings", "feed"]);
    const mixed = await queryListings({ categorySlug: "jobs", citySlug: "surat" });
    expect(mixed).toMatchObject({ total: 3, realTotal: 1 });
  });
});

describe("H17.1 the words of a listing page", () => {
  const note = TEXT_DEFAULTS["listing.sampleCount"];

  it("the sample-ads line is a site text with these words", () => {
    expect(note).toBe("Sample ads shown until local ads are posted");
  });

  it("with no real ads the description, intro and questions say the sample line, never '0 live ads'", () => {
    const copy = fallbackLanding({ category: "Jobs", city: "Surat", count: 0, site: "Tharkoo", sampleNote: note });
    const all = [copy.title, copy.description, copy.intro, ...copy.faqs.map((item) => `${item.q} ${item.a}`)].join(" ");
    expect(copy.description).toContain(note);
    expect(copy.intro).toContain(note);
    expect(all).not.toMatch(/\b0 live\b|\b0 jobs ads\b/i);
    const rich = fallbackLanding({ category: "Jobs", city: "Surat", count: 0, site: "Tharkoo", indexable: true, sampleNote: note });
    expect(rich.intro).toContain(note);
    expect(rich.intro).not.toMatch(/\b0 live\b/i);
  });

  it("with real ads the words still give the number", () => {
    const copy = fallbackLanding({ category: "Jobs", city: "Surat", count: 16, site: "Tharkoo", sampleNote: note });
    expect(copy.description).toContain("16 live ads");
    expect(copy.description).not.toContain(note);
    expect(copy.intro).toContain("16");
  });
});
