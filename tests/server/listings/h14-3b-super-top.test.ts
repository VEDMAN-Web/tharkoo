import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sellerDashboard } from "@/server/listings/seller-dashboard";
import { AdEvent } from "@/server/models/ad-event";
import { Listing, PromotionOrder, PromotionProduct, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const NOW = new Date("2026-11-18T10:00:00Z");
const at = (day: number, hour: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+05:30`);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AdEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

let counter = 0;
async function views(listingId: mongoose.Types.ObjectId, when: Date, count: number) {
  const rows = Array.from({ length: count }, () => ({ listingId, type: "view", visitorKey: `visitor-${(counter += 1)}`, createdAt: new Date(when.getTime() + counter * 1000) }));
  await AdEvent.collection.insertMany(rows);
}

async function seed(code: string) {
  const user = await User.create({ email: `seller-${code}@example.test`, displayName: "Ajay", roles: ["user"], verificationStatus: "unsubmitted", status: "active" });
  const ad = await Listing.create({ ownerId: user._id, categoryId: new mongoose.Types.ObjectId(), status: "active", title: "Toyota Innova", description: "A description that is long enough", slug: `toyota-${code}-aaa111`, publishedAt: new Date("2026-10-01T05:00:00Z"), expiresAt: new Date("2026-11-30T05:00:00Z") });
  await views(ad._id, at(9, 11), 14);
  await views(ad._id, at(15, 11), 40);
  const product = await PromotionProduct.create({ code, name: code, description: code, amount: 100, currency: "INR", durationDays: 2, enabled: true });
  await PromotionOrder.create({ userId: user._id, listingId: ad._id, productId: product._id, status: "active", durationDays: 2, startsAt: at(15, 0), endsAt: at(17, 0) });
  return user;
}

describe("H14.3b: a super-top boost counts as a TOP-type boost", () => {
  it("shades its days gold and gives the lift card its numbers", async () => {
    const user = await seed("super-top");
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.days.map((day) => day.topOn)).toEqual([false, false, false, true, true, false, false]);
    expect(data.lift).toMatchObject({ adTitle: "Toyota Innova", times: 10, during: 20, before: 2 });
  });

  it("does not count a boost that is not a TOP type", async () => {
    const user = await seed("star");
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.days.every((day) => !day.topOn)).toBe(true);
    expect(data.lift).toBeNull();
  });
});
