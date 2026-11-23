import mongoose from "mongoose";
import { listEmail } from "@/server/admin/users";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cityLabel } from "@/lib/admin/city-label";
import { listAds, parseAdsQuery } from "@/server/admin/ads-list";
import { listOrders, parseOrderQuery } from "@/server/admin/orders";
import { listUsers, parseUserQuery } from "@/server/admin/users";
import { FEE_REF } from "@/server/billing/posting-fee";
import { Listing, Location, MediaAsset, PromotionOrder, User, WalletEntry } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const category = new mongoose.Types.ObjectId();

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

async function person(email: string, displayName: string) {
  return User.create({ email, displayName, roles: ["user"], status: "active" });
}

describe("H7.172 All ads, Users and Orders lists", () => {
  it("shows a small picture of each ad that has one, and none for an ad without", async () => {
    const owner = await person("riya@example.test", "Riya Thakur");
    const asset = await MediaAsset.create({ ownerId: owner._id, kind: "image", objectKey: "/uploads/riya-sofa.jpg", status: "cleared" });
    const withPhoto = await Listing.create({ ownerId: owner._id, status: "active", categoryId: category, title: "Teak sofa", description: "A well kept sofa", mediaIds: [asset._id], coverMediaId: asset._id });
    await Listing.create({ ownerId: owner._id, status: "active", categoryId: category, title: "Study table", description: "A well kept table" });
    const rows = (await listAds(["moderator"], parseAdsQuery({}))).rows;
    expect(rows.find((row) => row.id === String(withPhoto._id))?.thumb).toBe("/uploads/riya-sofa.jpg");
    expect(rows.find((row) => row.title === "Study table")?.thumb).toBeNull();
  });

  it("calls the built-in demo account Demo in the ads list and the users list, and leaves real names alone", async () => {
    const seed = await person(SEED_USER_EMAIL, "Seed");
    const real = await person("riya@example.test", "Riya Thakur");
    await Listing.create({ ownerId: seed._id, status: "active", categoryId: category, title: "Demo tutor", description: "A demo ad", slug: "demo-1001" });
    await Listing.create({ ownerId: real._id, status: "active", categoryId: category, title: "Real tutor", description: "A real ad" });
    const ads = (await listAds(["moderator"], parseAdsQuery({}))).rows;
    expect(ads.find((row) => row.title === "Demo tutor")?.seller).toBe("Demo");
    expect(ads.find((row) => row.title === "Real tutor")?.seller).toBe("Riya Thakur");
    const users = (await listUsers(parseUserQuery({}), ["admin"])).rows;
    expect(users.find((row) => row.email === listEmail(SEED_USER_EMAIL))?.name).toBe("Demo");
    expect(users.find((row) => row.email === listEmail("riya@example.test"))?.name).toBe("Riya Thakur");
    expect((await User.findOne({ email: SEED_USER_EMAIL }))?.displayName).toBe("Seed");
  });

  it("shows a city by its place name, in title case, or Not set, without changing what is stored", async () => {
    expect(["surat", "SURAT", "new delhi", "navi-mumbai", "", "  ", "unknown", null, undefined].map(cityLabel)).toEqual(["Surat", "Surat", "New Delhi", "Navi-Mumbai", "Not set", "Not set", "Not set", "Not set", "Not set"]);
    await Location.create({ name: "Pune", slug: "pune", type: "city", stateSlug: "maharashtra", order: 0, enabled: true } as never);
    const stored = [["a@example.test", "pune"], ["b@example.test", "surat"], ["c@example.test", "unknown"], ["d@example.test", undefined]] as const;
    for (const [email, city] of stored) await User.create({ email, displayName: email, roles: ["user"], status: "active", ...(city ? { sellerProfile: { city, name: email, completedAt: new Date() } } : {}) });
    const rows = (await listUsers(parseUserQuery({}), ["admin"])).rows;
    const shown = Object.fromEntries(rows.map((row) => [row.email.replace("@\u2026", "@example.test"), row.cityName]));
    expect(shown).toMatchObject({ "a@example.test": "Pune", "b@example.test": "Surat", "c@example.test": "Not set", "d@example.test": "Not set" });
    expect((await User.findOne({ email: "c@example.test" }))?.sellerProfile?.city).toBe("unknown");
  });

  it("names the ad on wallet rows for a posting fee and for a promotion", async () => {
    const owner = await person("riya@example.test", "Riya Thakur");
    const ad = await Listing.create({ ownerId: owner._id, status: "active", categoryId: category, title: "Teak sofa", description: "A well kept sofa" });
    const order = await PromotionOrder.create({ userId: owner._id, listingId: ad._id, productId: new mongoose.Types.ObjectId(), status: "active", durationDays: 1 });
    const at = new Date();
    await WalletEntry.collection.insertMany([
      { userId: owner._id, delta: -30, reason: "debit", refType: FEE_REF, refId: `${ad._id}:0`, balanceAfter: 70, idempotencyKey: "i1", createdAt: at },
      { userId: owner._id, delta: -50, reason: "debit", refType: "promotion", refId: String(order._id), balanceAfter: 20, idempotencyKey: "i2", createdAt: new Date(at.getTime() - 1000) },
      { userId: owner._id, delta: 100, reason: "credit", refType: "staff_adjust", refId: "gift-1", balanceAfter: 100, idempotencyKey: "i3", createdAt: new Date(at.getTime() - 2000) },
    ]);
    const list = await listOrders(parseOrderQuery({ tab: "wallet", range: "all" }), ["finance"], at);
    const bySub = (ref: string) => list.rows.find((row) => row.ref === ref);
    expect(bySub("Posting fee")?.sub).toBe("Teak sofa");
    expect(bySub("Promotion")?.sub).toBe("Teak sofa");
    expect(bySub("Posting fee")?.details).toContainEqual(["Ad", "Teak sofa"]);
    expect(bySub("Staff change")?.sub).toBe("gift-1");
  });
});
