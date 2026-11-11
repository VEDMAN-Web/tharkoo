import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AuditEvent,
  Category,
  Coupon,
  IdentityVerification,
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
    expect(Listing.modelName).toBe("Listing");
    expect(Listing.collection.collectionName).toBe("listings");
  });

  it.each([
    [Category, "Category", "categories"],
    [Coupon, "Coupon", "coupons"],
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

  it("stores a listing on the listings collection and keeps coupon codes unique", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();
    const created = await Listing.create({
      ownerId,
      categoryId,
      title: "Hatchback in Pune",
      description: "A used hatchback kept in a covered garage.",
    });
    expect(created.status).toBe("draft");
    const inListings = await mongoose.connection.collection("listings").countDocuments({ _id: created._id });
    const inV2 = await mongoose.connection.collection("listings_v2").countDocuments({ _id: created._id });
    expect(inListings).toBe(1);
    expect(inV2).toBe(0);

    await Coupon.create({ code: "WELCOME", kind: "percent", percent: 10, credits: null });
    await expect(Coupon.create({ code: "WELCOME", kind: "credits", credits: 5 })).rejects.toThrow();
  });

  it("stores front, optional back, and selfie, and copies front into documentRef", async () => {
    const userId = new mongoose.Types.ObjectId();
    const front = new mongoose.Types.ObjectId().toString();
    const selfie = new mongoose.Types.ObjectId().toString();
    const created = await IdentityVerification.create({
      userId,
      provider: "manual",
      documentRef: front,
      documents: { front, selfie },
      status: "pending_review",
      dateOfBirthAsserted: new Date("1995-04-02"),
    });
    expect(created.documents?.front).toBe(front);
    expect(created.documents?.back).toBeUndefined();
    expect(created.documents?.selfie).toBe(selfie);
    expect(created.documentRef).toBe(front);
    await expect(
      IdentityVerification.create({
        userId,
        documentRef: front,
        documents: { front },
        status: "pending_review",
        dateOfBirthAsserted: new Date("1995-04-02"),
      }),
    ).rejects.toThrow();
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
