import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { generateMetadata as adMetadata } from "@/app/ad/[slug]/page";
import { shardEntries, sitemapXml } from "@/lib/seo/sitemaps";
import { Category, Listing, Location, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H17.8 (Vedant's decision, 19 Nov): sample (demo) ads are out of Google; real ads are unchanged. */

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

const robotsOf = (meta: { robots?: unknown }) => meta.robots as { index?: boolean; follow?: boolean } | undefined;

async function world() {
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const real = await User.create({ email: "real-seller@example.test", displayName: "Real", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const jobs = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: null, enabled: true, order: 0 });
  const make = (slug: string, owner: mongoose.Types.ObjectId, seoNoindex: boolean) =>
    Listing.create({ ownerId: owner, categoryId: jobs._id, cityId: surat._id, title: `Office role ${slug}`, description: "A description that is long enough to be a listing.", slug, status: "active", seoNoindex, publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) });
  return { seed, real, make };
}

describe("H17.8 sample ads out of Google", () => {
  it("a sample ad page says noindex,follow, even when its own setting says index", async () => {
    const w = await world();
    await w.make("demo-0101", w.seed._id, true);
    await w.make("demo-0102", w.seed._id, false);
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "demo-0101" }) }))).toMatchObject({ index: false, follow: true });
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "demo-0102" }) }))).toMatchObject({ index: false, follow: true });
  });

  it("a real ad page that is set to be indexed has no noindex (the site switch is off in this test)", async () => {
    const w = await world();
    await w.make("real-role-h178a", w.real._id, false);
    expect(robotsOf(await adMetadata({ params: Promise.resolve({ slug: "real-role-h178a" }) }))).toMatchObject({ index: true });
  });

  it("the ads sitemap has no sample ad, and still lists a real ad", async () => {
    const w = await world();
    await w.make("demo-0103", w.seed._id, false);
    await w.make("real-role-h178b", w.real._id, false);
    const urls = (await shardEntries("ads")).map((row) => row.loc).join(" ");
    expect(urls).not.toContain("demo-0103");
    expect(urls).toContain("real-role-h178b");
  });

  it("with only sample ads the ads sitemap is empty and still a valid sitemap", async () => {
    const w = await world();
    await w.make("demo-0104", w.seed._id, false);
    const entries = await shardEntries("ads");
    expect(entries).toEqual([]);
    const xml = sitemapXml(entries);
    expect(xml).toMatch(/^<\?xml[^>]*\?><urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>$/);
  });
});
