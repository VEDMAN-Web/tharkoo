import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { PromotionOrder, PromotionProduct } from "@/server/models";
import { runningPromotions, topAdIds } from "@/server/listings/owner-cards";

/** My ads: an ad with a promotion running now shows which one and when it ends (the strongest if there are several). */

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

const id = () => new mongoose.Types.ObjectId();
const HOUR = 3_600_000;

async function product(code: string, name: string) {
  return PromotionProduct.create({ code, name, description: name, amount: 100, currency: "INR", durationDays: 1, durationHours: 24 });
}

async function order(listingId: mongoose.Types.ObjectId, productId: unknown, over: { status?: string; startsAt?: Date; endsAt?: Date } = {}) {
  const now = Date.now();
  await PromotionOrder.collection.insertOne({
    productId,
    listingId,
    status: over.status ?? "active",
    startsAt: over.startsAt ?? new Date(now - HOUR),
    endsAt: over.endsAt ?? new Date(now + HOUR),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("runningPromotions", () => {
  it("names the promotion running now and when it ends, and nothing for an ad without one", async () => {
    const top = await product("top", "TOP");
    const [promoted, plain, ended, notStarted, cancelled] = [id(), id(), id(), id(), id()];
    const endsAt = new Date(Date.now() + 5 * HOUR);
    await order(promoted, top._id, { endsAt });
    await order(ended, top._id, { endsAt: new Date(Date.now() - HOUR) });
    await order(notStarted, top._id, { startsAt: new Date(Date.now() + HOUR), endsAt: new Date(Date.now() + 2 * HOUR) });
    await order(cancelled, top._id, { status: "cancelled" });
    const found = await runningPromotions([promoted, plain, ended, notStarted, cancelled], new Date());
    expect([...found.keys()]).toEqual([String(promoted)]);
    expect(found.get(String(promoted))).toEqual({ code: "top", name: "TOP", endsAt: endsAt.toISOString() });
  });

  it("shows the strongest one when an ad has several running, and still counts it for the video calls switch", async () => {
    const top = await product("top", "TOP");
    const superTop = await product("super-top", "Super Top");
    const bump = await product("bump", "Bump");
    const both = id();
    await order(both, bump._id);
    await order(both, top._id);
    await order(both, superTop._id);
    const found = await runningPromotions([both], new Date());
    expect(found.get(String(both))?.name).toBe("Super Top");
    expect((await topAdIds([both], new Date())).has(String(both))).toBe(true);
  });

  it("is empty with no ads", async () => {
    expect((await runningPromotions([], new Date())).size).toBe(0);
  });
});
