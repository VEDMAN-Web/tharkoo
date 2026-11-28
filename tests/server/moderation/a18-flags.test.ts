import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getReviewDetail, listReviewTab, ruleFlags } from "@/server/moderation/review";
import { Listing, Site, User } from "@/server/models";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ADMIN = ["admin"];

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("rule flags", () => {
  it("flags a phone number in the words of an ad, and nothing else", () => {
    expect(ruleFlags("Desk for sale", "Solid oak, good condition")).toEqual([]);
    expect(ruleFlags("Call me", "on 98765 43210 today")).toEqual(["Phone in text"]);
    expect(ruleFlags("Call +91 9876543210", "x")).toEqual(["Phone in text"]);
    expect(ruleFlags("Coffee", "9876543210")).toEqual(["Phone in text"]);
  });
});

describe("rows and detail for the drawer", () => {
  it("carry the flags, the seller's numbers, and the ID check", async () => {
    const owner = await User.create({ email: "seller@example.test", displayName: "Riya", roles: ["user"], status: "active", verificationStatus: "pending_review" });
    await Site.create({ key: "main", postModerationSince: new Date(Date.now() - 86_400_000) });
    const flagged = await Listing.create({ ownerId: owner._id, categoryId: new mongoose.Types.ObjectId(), status: "active", title: "Coffee and a walk", description: "Call 9876543210 for an offer", publishedAt: new Date() });
    await Listing.create({ ownerId: owner._id, categoryId: new mongoose.Types.ObjectId(), status: "paused", title: "Other", description: "A description that is long enough" });
    const list = await listReviewTab(ADMIN, { tab: "live", q: "", page: 1, pageSize: 25 });
    expect(list.rows[0]).toMatchObject({ title: "Coffee and a walk", flags: ["Phone in text"], thumb: null });
    const detail = await getReviewDetail(ADMIN, String(flagged._id));
    expect(detail).toMatchObject({ seller: "Riya", sellerAds: 2, idCheck: "Waiting", flags: ["Phone in text"] });
    expect(detail.sellerJoined).toBeTruthy();
  });
});
