import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shardEntries } from "@/lib/seo/sitemaps";
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

describe("H16.2 the ads sitemap lists the new addresses", () => {
  it("lists an indexable ad at /<category>/<city>/<title>-<code>/, and an ad with no code at its old link", async () => {
    const dating = await Category.create({ slug: "dating", name: "Dating", enabled: true });
    const surat = await Location.create({ slug: "surat", name: "Surat", type: "city", enabled: true });
    const base = {
      ownerId: owner,
      categoryId: dating._id,
      cityId: surat._id,
      description: "A description that is long enough",
      status: "active" as const,
      seoNoindex: false,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const ad = await Listing.create({ ...base, title: "Coffee and Long Walks", slug: "coffee-and-long-walks" });
    await Listing.collection.insertOne({ ...base, title: "Older ad", slug: "older-ad", createdAt: new Date(), updatedAt: new Date() });

    const locs = (await shardEntries("ads")).map((entry) => new URL(entry.loc).pathname);
    expect(locs).toContain(`/dating/surat/coffee-and-long-walks-${ad.code}/`);
    expect(locs).toContain("/ad/older-ad/");
    expect(locs).not.toContain("/ad/coffee-and-long-walks/");
  });
});
