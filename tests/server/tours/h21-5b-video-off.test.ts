import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { promote } from "../../setup/wallets";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { Category, Listing } from "@/server/models";
import { listingPatchBodySchema } from "@/server/shared/schemas/listings";
import { ownerView } from "@/server/listings/service";
import { requestTour } from "@/server/tours/service";
import { videoTourOffer } from "@/server/tours/offer";
import { ConflictError } from "@/server/http";

/** H21.5b: the owner's per-ad switch that turns video calls off. */

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

async function liveAd(videoCallsOff?: boolean) {
  const category = await Category.create({ slug: `cat-${Date.now()}-${Math.random()}`, name: "Cars", kind: "goods", videoTourEnabled: true, videoTourCoins: 2 });
  const listing = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: category._id,
    status: "active",
    title: "Used car",
    description: "A description that is long enough",
    publishedAt: new Date(),
    ...(videoCallsOff === undefined ? {} : { videoCallsOff }),
  });
  await promote(String(listing._id), String(listing.ownerId));
  return listing;
}

describe("H21.5b videoCallsOff", () => {
  it("is false by default and the video button is offered", async () => {
    const ad = await liveAd();
    expect(ad.videoCallsOff).toBe(false);
    expect(await videoTourOffer(String(ad._id))).toEqual({ coins: 2 });
  });

  it("hides the video button when it is set", async () => {
    const ad = await liveAd(true);
    expect(await videoTourOffer(String(ad._id))).toBeNull();
  });

  it("refuses a tour request with 409 when it is set", async () => {
    const ad = await liveAd(true);
    const asker = new mongoose.Types.ObjectId().toString();
    const error = await requestTour({ userId: asker, listingId: String(ad._id), requestId: "req-off" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("Video calls are off for this ad");
  });

  it("is accepted by the details save and shown in the owner view", async () => {
    expect(listingPatchBodySchema.safeParse({ stage: "details", videoCallsOff: true }).success).toBe(true);
    expect(listingPatchBodySchema.safeParse({ stage: "details", videoCallsOff: "yes" }).success).toBe(false);
    const ad = await liveAd(true);
    expect(ownerView(ad.toObject() as never).videoCallsOff).toBe(true);
  });
});
