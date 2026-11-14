import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { validatePost } from "@/lib/ui/post-form";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  reorder,
  updateCategory,
  updateSubcategory,
} from "@/server/categories/manage";
import {
  findSubcategory,
  indexableSubcategoryHubs,
  isSubcategoryIndexable,
  listSubcategories,
  resolveSubcategory,
  subcategoriesByCategory,
  subcategoryChips,
  subcategoryFeed,
} from "@/server/categories/public";
import { Category, Listing, Location } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "", roles: ["admin"] };

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
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
  invalidateTags(["categories", "locations", "listings"]);
});

async function city(slug: string) {
  const doc = await Location.create({ type: "city", slug, name: slug.toUpperCase(), parentId: null, enabled: true });
  return String(doc._id);
}

/** Adds an ad. The sub-category is set straight in the database because the listing schema is not part of this card. */
async function ad(categoryId: string, cityId: string, subcategoryId: string | null, status: "active" | "paused" = "active") {
  const doc = await Listing.create({
    ownerId: new Types.ObjectId(),
    categoryId: new Types.ObjectId(categoryId),
    cityId: new Types.ObjectId(cityId),
    status,
    title: "A title here",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  if (subcategoryId) await Listing.collection.updateOne({ _id: doc._id }, { $set: { subcategoryId: new Types.ObjectId(subcategoryId) } });
  return String(doc._id);
}

async function setup() {
  const { id: categoryId } = await createCategory(admin, { name: "Services" });
  const { id: plumbers } = await createSubcategory(admin, { categoryId, name: "Plumbers" });
  const { id: tutors } = await createSubcategory(admin, { categoryId, name: "Tutors" });
  const mumbai = await city("mumbai");
  const pune = await city("pune");
  return { categoryId, plumbers, tutors, mumbaiId: mumbai, puneId: pune };
}

describe("managing sub-categories", () => {
  it("blocks anyone who is not an admin", async () => {
    const { categoryId } = await setup();
    const user = { email: "", roles: ["user"] };
    await expect(createSubcategory(user, { categoryId, name: "Cleaners" })).rejects.toThrow(/admin/i);
    await expect(createCategory(user, { name: "Nope" })).rejects.toThrow(/admin/i);
  });

  it("creates with a slug taken from the name and refuses a repeated slug and bad input", async () => {
    const { categoryId } = await setup();
    const rows = await listSubcategories(categoryId);
    expect(rows.map((row) => row.slug)).toEqual(["plumbers", "tutors"]);
    await expect(createSubcategory(admin, { categoryId, name: "Plumbers again", slug: "plumbers" })).rejects.toThrow(/already used/);
    await expect(createSubcategory(admin, { categoryId: "nope", name: "X" })).rejects.toThrow();
    await expect(createSubcategory(admin, { categoryId, name: "   " })).rejects.toThrow(/Name is required/);
  });

  it("reorders by the position in the list", async () => {
    const { categoryId, plumbers, tutors } = await setup();
    await reorder(admin, "subcategory", [tutors, plumbers]);
    expect((await listSubcategories(categoryId)).map((row) => row.slug)).toEqual(["tutors", "plumbers"]);
    await expect(reorder(admin, "subcategory", [tutors, tutors])).rejects.toThrow();
    await expect(reorder(admin, "subcategory", [String(new Types.ObjectId())])).rejects.toThrow(/no longer exists/);
  });

  it("reorders categories too", async () => {
    const { categoryId } = await setup();
    const { id: other } = await createCategory(admin, { name: "Jobs" });
    await reorder(admin, "category", [other, categoryId]);
    const rows = await Category.find({}).sort({ order: 1 }).lean();
    expect(rows.map((row) => row.slug)).toEqual(["jobs", "services"]);
  });

  it("hides a sub-category from visitors but keeps it for the admin", async () => {
    const { categoryId, plumbers } = await setup();
    await updateSubcategory(admin, plumbers, { enabled: false });
    expect((await listSubcategories(categoryId)).map((row) => row.slug)).toEqual(["tutors"]);
    expect(await listSubcategories(categoryId, { includeHidden: true })).toHaveLength(2);
    expect(await findSubcategory(categoryId, "plumbers")).toBeNull();
    expect(Object.values(await subcategoriesByCategory())[0].map((row) => row.slug)).toEqual(["tutors"]);
  });

  it("keeps the old slug working after a rename", async () => {
    const { categoryId, plumbers } = await setup();
    await updateSubcategory(admin, plumbers, { slug: "plumbing", name: "Plumbing", icon: "wrench", seoIntro: "Find a plumber." });
    const found = await findSubcategory(categoryId, "plumbers");
    expect(found?.redirectTo).toBe("plumbing");
    expect((await findSubcategory(categoryId, "plumbing"))?.sub).toMatchObject({ name: "Plumbing", icon: "wrench", seoIntro: "Find a plumber." });
    await expect(updateSubcategory(admin, plumbers, { slug: "tutors" })).rejects.toThrow(/already used/);
  });

  it("blocks removing a sub-category that has ads, and removes an empty one", async () => {
    const { categoryId, plumbers, tutors, mumbaiId } = await setup();
    await ad(categoryId, mumbaiId, plumbers);
    await expect(deleteSubcategory(admin, plumbers)).rejects.toThrow(/has ads\. Hide it/);
    expect(await Subcategory.findById(plumbers)).not.toBeNull();
    await deleteSubcategory(admin, tutors);
    expect(await Subcategory.findById(tutors)).toBeNull();
  });

  it("blocks removing a category that has ads, offers hiding, and takes sub-categories with an empty category", async () => {
    const { categoryId, mumbaiId } = await setup();
    await ad(categoryId, mumbaiId, null);
    await expect(deleteCategory(admin, categoryId)).rejects.toThrow(/Hide it/);
    await updateCategory(admin, categoryId, { enabled: false, seoIntro: "Hidden for now" });
    expect(await Category.findById(categoryId)).toMatchObject({ enabled: false, introHtml: "Hidden for now" });
    const { id: empty } = await createCategory(admin, { name: "Empty" });
    await createSubcategory(admin, { categoryId: empty, name: "Inside" });
    await deleteCategory(admin, empty);
    expect(await Category.findById(empty)).toBeNull();
    expect(await Subcategory.countDocuments({ categoryId: empty })).toBe(0);
  });

  it("renames a category slug through the redirect-keeping path", async () => {
    const { categoryId } = await setup();
    await updateCategory(admin, categoryId, { slug: "pros" });
    expect(await Category.findById(categoryId)).toMatchObject({ slug: "pros", oldSlugs: ["services"] });
  });
});

describe("sub-category pages and chips", () => {
  it("counts live ads per sub-category in a city and leaves out empty ones", async () => {
    const { categoryId, plumbers, tutors, mumbaiId, puneId } = await setup();
    await ad(categoryId, mumbaiId, plumbers);
    await ad(categoryId, mumbaiId, plumbers);
    await ad(categoryId, mumbaiId, plumbers, "paused");
    await ad(categoryId, puneId, tutors);
    expect(await subcategoryChips("services", "mumbai")).toEqual([{ slug: "plumbers", name: "Plumbers", count: 2, citySlug: "mumbai" }]);
    const all = await subcategoryChips("services");
    expect(all.map((chip) => [chip.slug, chip.count, chip.citySlug])).toEqual([
      ["plumbers", 2, "mumbai"],
      ["tutors", 1, "pune"],
    ]);
    expect(await subcategoryChips("services", "nowhere")).toEqual([]);
    expect(await subcategoryChips("missing")).toEqual([]);
  });

  it("lists only that sub-category's ads in that city", async () => {
    const { categoryId, plumbers, tutors, mumbaiId, puneId } = await setup();
    await ad(categoryId, mumbaiId, plumbers);
    await ad(categoryId, mumbaiId, tutors);
    await ad(categoryId, puneId, plumbers);
    const feed = await subcategoryFeed({ categoryId, cityId: mumbaiId, subcategoryId: plumbers, page: 1 });
    expect(feed.total).toBe(1);
    expect(feed.items).toHaveLength(1);
    expect(feed.pages).toBe(1);
  });

  it("is indexable only on page one with five or more real ads", () => {
    expect(isSubcategoryIndexable(4)).toBe(false);
    expect(isSubcategoryIndexable(5)).toBe(true);
    expect(isSubcategoryIndexable(50, 2)).toBe(false);
  });

  it("puts only pages with five or more active ads in the sitemap list", async () => {
    const { categoryId, plumbers, tutors, mumbaiId } = await setup();
    for (let index = 0; index < 5; index += 1) await ad(categoryId, mumbaiId, plumbers);
    for (let index = 0; index < 4; index += 1) await ad(categoryId, mumbaiId, tutors);
    expect(await indexableSubcategoryHubs()).toEqual([{ category: "services", city: "mumbai", sub: "plumbers", count: 5 }]);
  });

  it("matches a typed name or slug for the CSV import", async () => {
    const { categoryId, plumbers } = await setup();
    expect(await resolveSubcategory(categoryId, "PLUMBERS")).toBe(plumbers);
    expect(await resolveSubcategory(categoryId, "plumbers")).toBe(plumbers);
    expect(await resolveSubcategory(categoryId, "unknown")).toBeNull();
    expect(await resolveSubcategory(categoryId, "")).toBeNull();
  });
});

describe("the post form check", () => {
  const base = { categoryId: "c", cityId: "x", nickname: "Asha", title: "A fine title", text: "A description that is long enough", phone: "9876543210", contactMode: "both", age: "", terms: true, adult: true, attrs: {}, fields: [] };

  it("asks for a sub-category only when the category has some", () => {
    expect(validatePost({ ...base, needsSubcategory: true }).subcategory).toBeTruthy();
    expect(validatePost({ ...base, needsSubcategory: true, subcategoryId: "s" }).subcategory).toBeUndefined();
    expect(validatePost({ ...base }).subcategory).toBeUndefined();
  });
});
