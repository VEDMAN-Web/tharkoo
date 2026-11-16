import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isPeopleCategory, listingIsPeople, peopleCategoryIds } from "@/server/availability/people";
import { Category, Listing } from "@/server/models";
import type { CategoryKind } from "@/server/models/catalog";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function liveShapedListing(slug: string, kind?: string) {
  const category = await Category.create({ slug, name: slug, kind: (kind ?? "goods") as CategoryKind });
  if (!kind) await Category.collection.updateOne({ _id: category._id }, { $unset: { kind: "" } });
  const listing = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: category._id,
    status: "active",
    title: "A title here",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  return { categoryId: String(category._id), listingId: String(listing._id) };
}

describe("people categories without a kind on the stored document (H7.99c)", () => {
  it("are decided from the slug list", () => {
    for (const slug of ["dating", "friendship", "meetups", "personal-ads", "personals"]) expect(isPeopleCategory({ slug })).toBe(true);
    expect(isPeopleCategory({ slug: "wellness" })).toBe(false);
    expect(isPeopleCategory({ slug: "wellness", kind: "people" })).toBe(true);
    expect(isPeopleCategory({ slug: "property" })).toBe(false);
    expect(isPeopleCategory({ slug: "jobs", kind: "job" })).toBe(false);
    expect(isPeopleCategory({ slug: "anything", kind: "people" })).toBe(true);
    expect(isPeopleCategory(null)).toBe(false);
  });

  it("make a dating ad a people ad even when the category has no kind", async () => {
    const dating = await liveShapedListing("dating");
    const property = await liveShapedListing("property");
    expect(await listingIsPeople(dating.listingId)).toBe(true);
    expect(await listingIsPeople(property.listingId)).toBe(false);
    const ids = await peopleCategoryIds([dating.categoryId, property.categoryId]);
    expect([...ids]).toEqual([dating.categoryId]);
  });

  it("leave wellness as it was: only its stored kind decides", async () => {
    const wellness = await liveShapedListing("wellness");
    expect(await listingIsPeople(wellness.listingId)).toBe(false);
    const stored = await liveShapedListing("wellness-kind", "people");
    expect(await listingIsPeople(stored.listingId)).toBe(true);
  });

  it("still honour the admin kind", async () => {
    const custom = await liveShapedListing("custom-people", "people");
    expect(await listingIsPeople(custom.listingId)).toBe(true);
  });
});
