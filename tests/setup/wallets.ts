import mongoose from "mongoose";
import { moveCallCredits } from "@/server/billing/wallets";
import { PromotionOrder } from "@/server/models";

let seq = 0;

/** H18.8: video calls need TOP or Super Top running. Gives a listing an active plan for a day. */
export async function promote(listingId: string, ownerId: string) {
  const now = Date.now();
  await PromotionOrder.create({
    userId: new mongoose.Types.ObjectId(ownerId),
    listingId: new mongoose.Types.ObjectId(listingId),
    productId: new mongoose.Types.ObjectId(),
    durationDays: 1,
    status: "active",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 86_400_000),
  });
}

/** H18.8: video calls are paid from call credits. */
export async function fundCalls(userId: string, coins: number) {
  seq += 1;
  await moveCallCredits({ userId, amount: coins, key: `test-fund:${userId}:${seq}:${Date.now()}`, kind: "test", requestId: "test" });
}
