import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { PromotionOrder, PromotionProduct } from "@/server/models";
import { topAdIds } from "@/server/listings/owner-cards";

/** H21.5c: the My ads Video calls switch shows only for an ad with TOP or Super Top running right now. */

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

async function product(code: string) {
  return PromotionProduct.create({ code, name: code, description: code, amount: 100, currency: "INR", durationDays: 1, durationHours: 24 });
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

describe("H21.5c topAdIds", () => {
  it("is true for TOP and Super Top running now, and for nothing else", async () => {
    const top = await product("top");
    const superTop = await product("super-top");
    const bump = await product("bump");
    const [onTop, onSuper, onBump, plain, ended, notStarted, cancelled] = [id(), id(), id(), id(), id(), id(), id()];
    await order(onTop, top._id);
    await order(onSuper, superTop._id);
    await order(onBump, bump._id);
    await order(ended, top._id, { endsAt: new Date(Date.now() - HOUR) });
    await order(notStarted, top._id, { startsAt: new Date(Date.now() + HOUR), endsAt: new Date(Date.now() + 2 * HOUR) });
    await order(cancelled, top._id, { status: "cancelled" });
    const found = await topAdIds([onTop, onSuper, onBump, plain, ended, notStarted, cancelled], new Date());
    expect([...found].sort()).toEqual([String(onTop), String(onSuper)].sort());
  });

  it("is empty with no ads", async () => {
    expect((await topAdIds([], new Date())).size).toBe(0);
  });
});
