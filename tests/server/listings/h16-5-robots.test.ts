import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { generateMetadata as adMetadata } from "@/app/ad/[slug]/page";
import { generateMetadata as placeMetadata } from "@/app/[category]/[location]/page";
import { Category, Listing, Location, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  delete process.env.SITE_NOINDEX;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "categories", "locations", "listings", "feed", "counts"]);
});

async function world() {
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: null, enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id, enabled: true, order: 0 });
  return { seed, jobs, state, surat };
}

const robotsOf = (meta: { robots?: unknown }) => meta.robots as { index?: boolean; follow?: boolean } | undefined;

describe("H16.5 robots on listing pages and sample ad pages", () => {
  it("a category and city page with no ads, and one with only sample ads, are index,follow; page 2 and a filtered page are not", async () => {
    const w = await world();
    const empty = await placeMetadata({ params: Promise.resolve({ category: "jobs", location: "surat" }), searchParams: Promise.resolve({}) });
    expect(robotsOf(empty)?.index).toBe(true);
    await Listing.create({ ownerId: w.seed._id, categoryId: w.jobs._id, stateId: w.state._id, cityId: w.surat._id, title: "Sample office role", description: "A description that is long enough to be a listing.", slug: "demo-0001", status: "active", seoNoindex: true, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
    invalidateTags(["feed", "counts", "listings"]);
    const withSamples = await placeMetadata({ params: Promise.resolve({ category: "jobs", location: "surat" }), searchParams: Promise.resolve({}) });
    expect(robotsOf(withSamples)?.index).toBe(true);
    const filtered = await placeMetadata({ params: Promise.resolve({ category: "jobs", location: "surat" }), searchParams: Promise.resolve({ photos: "1" }) });
    expect(robotsOf(filtered)?.index).toBe(false);
  });

  it("a live sample ad page is index,follow like a real ad that is set to be indexed; a real ad not set to be indexed is not", async () => {
    const w = await world();
    const make = (slug: string, owner: mongoose.Types.ObjectId, noindex: boolean) =>
      Listing.create({ ownerId: owner, categoryId: w.jobs._id, stateId: w.state._id, cityId: w.surat._id, title: `Office role ${slug}`, description: "A description that is long enough to be a listing.", slug, status: "active", seoNoindex: noindex, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
    await make("demo-0002", w.seed._id, true);
    await make("real-role-k7q2", new mongoose.Types.ObjectId(), false);
    await make("hidden-role-k7q3", new mongoose.Types.ObjectId(), true);
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "demo-0002" }) }))?.index).toBe(true);
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "real-role-k7q2" }) }))?.index).toBe(true);
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "hidden-role-k7q3" }) }))?.index).toBe(false);
  });
});
