import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Category, Listing } from "@/server/models";
import type { CategoryKind } from "@/server/models/catalog";
import { videoTourOffer } from "@/server/tours/offer";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

let counter = 0;
const key = (prefix: string) => `${prefix}-${(counter += 1)}`;

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

/** An active ad in a category with the given kind, switch and price. */
async function adIn(opts: { kind?: CategoryKind | null; enabled?: boolean; coins?: number }) {
  const category = await Category.create({
    slug: key("cat"),
    name: "Cars",
    kind: opts.kind ?? "goods",
    videoTourEnabled: opts.enabled ?? true,
    videoTourCoins: opts.coins ?? 1,
  });
  if (opts.kind === null) await Category.collection.updateOne({ _id: category._id }, { $unset: { kind: "" } });
  const listing = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: category._id,
    status: "active",
    title: "Used car",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  return String(listing._id);
}

describe("videoTourOffer (ad page button)", () => {
  it("offers the category price on an eligible ad", async () => {
    const listingId = await adIn({ kind: "goods", enabled: true, coins: 3 });
    expect(await videoTourOffer(listingId)).toEqual({ coins: 3 });
  });

  it("offers nothing for a people category, even when its switch is on in the database", async () => {
    const listingId = await adIn({ kind: "people", enabled: true, coins: 1 });
    expect(await videoTourOffer(listingId)).toBeNull();
  });

  it("offers nothing when the switch is off", async () => {
    const listingId = await adIn({ kind: "goods", enabled: false, coins: 1 });
    expect(await videoTourOffer(listingId)).toBeNull();
  });

  it("offers nothing when the category has no kind", async () => {
    const listingId = await adIn({ kind: null, enabled: true, coins: 1 });
    expect(await videoTourOffer(listingId)).toBeNull();
  });

  it("offers nothing for an ad that does not exist", async () => {
    expect(await videoTourOffer(new mongoose.Types.ObjectId().toString())).toBeNull();
  });

  it("offers nothing for an id that is not an ObjectId", async () => {
    expect(await videoTourOffer("not-an-id")).toBeNull();
  });
});
