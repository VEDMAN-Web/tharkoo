import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { shardEntries } from "@/lib/seo/sitemaps";
import { TEMPLATE_PAGE_TYPES } from "@/lib/seo/landing";
import { Category, Listing, Location } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

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
  invalidateTags(["categories", "locations", "listings"]);
});

async function ads(categoryId: Types.ObjectId, cityId: Types.ObjectId, subcategoryId: Types.ObjectId, count: number) {
  for (let n = 0; n < count; n += 1) {
    await Listing.create({
      ownerId: new Types.ObjectId(),
      categoryId,
      subcategoryId,
      cityId,
      status: "active",
      title: `Ad number ${n}`,
      description: "A description that is long enough",
      publishedAt: new Date(),
    });
  }
}

describe("districts sitemap shard", () => {
  it("includes an indexable sub-category hub and excludes one with 4 ads", async () => {
    const cat = await Category.create({ slug: "services", name: "Services", enabled: true, fields: [] });
    const city = await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
    const full = await Subcategory.create({ categoryId: cat._id, slug: "plumbers", name: "Plumbers" });
    const thin = await Subcategory.create({ categoryId: cat._id, slug: "tutors", name: "Tutors" });
    await ads(cat._id, city._id, full._id, 5);
    await ads(cat._id, city._id, thin._id, 4);
    const locs = (await shardEntries("districts")).map((entry) => entry.loc);
    expect(locs.some((loc) => loc.includes("/services/pune/plumbers")), JSON.stringify(locs)).toBe(true);
    expect(locs.some((loc) => loc.includes("/tutors"))).toBe(false);
  });
});

describe("template page types", () => {
  it("offers the sub-category hub", () => {
    expect(TEMPLATE_PAGE_TYPES.some((type) => type.key === "subcategory")).toBe(true);
  });
});
