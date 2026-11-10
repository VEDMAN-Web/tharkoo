import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AuditEvent,
  Category,
  Coupon,
  Listing,
  User,
  WalletEntry,
  type ListingDoc,
} from "@/server/models";
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
});

describe("model names and collections", () => {
  it("imports Listing with an explicit document type and a V2 registration", () => {
    const sample: Pick<ListingDoc, "title" | "description"> = {
      title: "Hatchback",
      description: "Garage kept",
    };
    expect(sample.title).toBe("Hatchback");
    expect(Listing.modelName).toBe("ListingV2");
    expect(Listing.collection.collectionName).toBe("listings_v2");
  });

  it.each([
    [Category, "CategoryV2", "categories_v2"],
    [Coupon, "CouponV2", "coupons_v2"],
    [User, "User", "users"],
    [AuditEvent, "AuditEvent", "audit_events"],
    [WalletEntry, "WalletEntry", "wallet_entries"],
  ])("registers %s", (model, name, collection) => {
    expect(model.modelName).toBe(name);
    expect(model.collection.collectionName).toBe(collection);
  });
});

describe("model validation", () => {
  it("rejects a user without an email and a listing without an owner", async () => {
    await expect(User.create({ displayName: "A" })).rejects.toThrow();
    await expect(
      Listing.create({ title: "Hatchback", description: "Garage kept" }),
    ).rejects.toThrow();
  });

  it("stores a listing on the v2 collection and keeps coupon codes unique", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();
    const created = await Listing.create({
      ownerId,
      categoryId,
      title: "Hatchback in Pune",
      description: "A used hatchback kept in a covered garage.",
    });
    expect(created.status).toBe("draft");
    const inV2 = await mongoose.connection
      .collection("listings_v2")
      .countDocuments({ _id: created._id });
    const inOld = await mongoose.connection.collection("listings").countDocuments({ _id: created._id });
    expect(inV2).toBe(1);
    expect(inOld).toBe(0);

    await Coupon.create({ code: "WELCOME", kind: "percent", percent: 10, credits: null });
    await expect(Coupon.create({ code: "WELCOME", kind: "credits", credits: 5 })).rejects.toThrow();
  });

  it("rejects a repeated wallet idempotency key", async () => {
    const userId = new mongoose.Types.ObjectId();
    const entry = {
      userId,
      delta: 100,
      reason: "pack",
      refType: "payment",
      refId: "pay-1",
      balanceAfter: 100,
      idempotencyKey: "pack-1",
    };
    await WalletEntry.create(entry);
    await expect(WalletEntry.create({ ...entry, delta: 50, balanceAfter: 150 })).rejects.toThrow();
  });
});
