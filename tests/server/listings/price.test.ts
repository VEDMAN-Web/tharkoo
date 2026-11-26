import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parsePrice, PRICE_MAX } from "@/server/listings/price";
import { duplicateListing, patchListing, publicView } from "@/server/listings/service";
import { Listing } from "@/server/models";
import { attributeDenied } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(disconnectMemoryMongo);
beforeEach(clearMemoryMongo);

async function draft() {
  const ownerId = new mongoose.Types.ObjectId();
  const row = await Listing.create({
    ownerId,
    status: "draft",
    categoryId: new mongoose.Types.ObjectId(),
    title: "Used cycle",
    description: "A well kept cycle for sale",
  });
  return { id: row._id.toString(), ownerId: ownerId.toString() };
}

describe("parsePrice", () => {
  it("accepts whole rupees in several spellings", () => {
    expect(parsePrice(4500)).toBe(4500);
    expect(parsePrice("4,500")).toBe(4500);
    expect(parsePrice("₹ 4500")).toBe(4500);
    expect(parsePrice("0")).toBe(0);
  });
  it("treats nothing as unchanged and null or empty as clear", () => {
    expect(parsePrice(undefined)).toBeUndefined();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("")).toBeNull();
  });
  it("rejects negatives, fractions, text and huge numbers", () => {
    for (const bad of [-1, 12.5, "abc", PRICE_MAX + 1, Number.NaN]) expect(() => parsePrice(bad)).toThrow();
  });
});

describe("listing price", () => {
  it("is saved on the details stage, shown in the public view and kept when duplicated", async () => {
    const { id, ownerId } = await draft();
    const saved = await patchListing(id, ownerId, { stage: "details", price: 4500 }, "req-1");
    expect(saved.price).toBe(4500);
    expect((await Listing.findById(id))?.price).toBe(4500);
    expect(publicView((await Listing.findById(id))!.toObject()).price).toBe(4500);
    const copy = await duplicateListing(id, ownerId, "req-2");
    expect(copy.price).toBe(4500);
  });

  it("can be cleared and is null when never set", async () => {
    const { id, ownerId } = await draft();
    expect(publicView((await Listing.findById(id))!.toObject()).price).toBeNull();
    await patchListing(id, ownerId, { stage: "details", price: 900 }, "req-1");
    const cleared = await patchListing(id, ownerId, { stage: "details", price: null }, "req-2");
    expect(cleared.price).toBeNull();
  });

  it("rejects an invalid price", async () => {
    const { id, ownerId } = await draft();
    await expect(patchListing(id, ownerId, { stage: "details", price: -5 }, "req-1")).rejects.toThrow();
  });

  it("does not loosen the attribute deny-list", () => {
    expect(attributeDenied({ price: 100 }).denied).toBe(true);
  });
});
