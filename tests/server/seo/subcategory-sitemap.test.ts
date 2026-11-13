import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { subcategorySitemapEntries } from "@/server/seo/subcategory-sitemap";
import { subcategoryCopy, validateTemplate } from "@/server/seo/templates";
import { Category, Listing, Location, SeoTemplate } from "@/server/models";
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

describe("sub-category sitemap", () => {
  it("lists a hub with 5 active ads and leaves out one with 4", async () => {
    const cat = await Category.create({ slug: "services", name: "Services", enabled: true, fields: [] });
    const city = await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
    const full = await Subcategory.create({ categoryId: cat._id, slug: "plumbers", name: "Plumbers" });
    const thin = await Subcategory.create({ categoryId: cat._id, slug: "tutors", name: "Tutors" });
    await ads(cat._id, city._id, full._id, 5);
    await ads(cat._id, city._id, thin._id, 4);
    const entries = await subcategorySitemapEntries((path) => `https://example.test${path}`);
    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toContain("/services/pune/plumbers");
  });
});

describe("sub-category template", () => {
  const fallback = { title: "Built in title", description: "Built in description", h1: "Built in h1", intro: "Built in intro" };
  const vars = { subcategory: "Plumbers", city: "Pune", count: 7, site: "Tharkoo" };

  it("uses the built-in copy with no template and the template fields when one is saved", async () => {
    expect(await subcategoryCopy("services", vars, fallback)).toEqual(fallback);
    const { key, fields } = validateTemplate({
      pageType: "subcategory",
      fields: { title: "{category} in {city}", h1: "{category} near you in {city}", description: "", intro: "" },
    });
    await SeoTemplate.create({ pageType: key, ...fields });
    const copy = await subcategoryCopy("services", vars, fallback);
    expect(copy.title).toBe("Plumbers in Pune");
    expect(copy.h1).toBe("Plumbers near you in Pune");
    expect(copy.description).toBe("Built in description");
  });
});
