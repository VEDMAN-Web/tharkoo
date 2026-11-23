import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { VideoTour } from "./model";
import { splitCall } from "./split";

export type CallEarningRow = { id: string; title: string; price: number; fee: number; youGot: number; at: string | null };

/** H19.10: what a vendor earned from paid video calls: the total and the latest calls with price, Tharkoo fee and what the vendor got. */
export async function callEarningsFor(ownerId: string, limit = 20) {
  await connectDb();
  const owner = new mongoose.Types.ObjectId(ownerId);
  const paid = await VideoTour.find({ ownerId: owner, status: "completed" }).sort({ endedAt: -1 }).lean();
  const rows = paid.slice(0, limit);
  const titles = new Map((await Listing.find({ _id: { $in: rows.map((row) => row.listingId) } }).select("title").lean<{ _id: unknown; title?: string }[]>()).map((row) => [String(row._id), row.title ?? ""]));
  const split = (price: number, percent?: number) => splitCall(price, percent ?? 0);
  return {
    total: paid.reduce((sum, row) => sum + split(row.coins, row.feePercent).vendor, 0),
    calls: rows.map(
      (row): CallEarningRow => ({
        id: String(row._id),
        title: titles.get(String(row.listingId)) ?? "",
        price: row.coins,
        fee: split(row.coins, row.feePercent).fee,
        youGot: split(row.coins, row.feePercent).vendor,
        at: row.endedAt ? new Date(row.endedAt).toISOString() : null,
      }),
    ),
  };
}

/**
 * H19.10: what a vendor keeps per call on their live ads, for the line "Users pay N credits per call. You keep M credits".
 * One row per distinct call price of the categories their live ads are in (video calls switched on).
 */
export async function callEarnInfoFor(ownerId: string) {
  await connectDb();
  const [{ readMoneySettings }, { Category }] = await Promise.all([import("@/server/billing/money-settings"), import("@/server/models")]);
  const owner = new mongoose.Types.ObjectId(ownerId);
  const categoryIds = await Listing.distinct("categoryId", { ownerId: owner, status: "active" });
  const categories = categoryIds.length ? await Category.find({ _id: { $in: categoryIds }, videoTourEnabled: true }).select("videoTourCoins").lean<{ videoTourCoins?: number }[]>() : [];
  const settings = await readMoneySettings();
  const prices = [...new Set(categories.map((row) => Math.max(row.videoTourCoins ?? 1, 10)))].sort((a, b) => a - b).slice(0, 3);
  return {
    sharePercent: settings.videoCallSharePercent,
    options: prices.map((price) => {
      const vendor = splitCall(price, settings.videoCallSharePercent).vendor;
      return { price, youKeep: vendor, rupees: vendor * settings.creditPriceInr };
    }),
  };
}

/** H19.10: what Tharkoo kept from paid video calls (net of reversals) today, in the last 7 days and in the last 30 days. Real ledger numbers. */
export async function platformCallRevenue(now = new Date()) {
  await connectDb();
  const { LedgerTransaction } = await import("@/server/ledger/model");
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const startOfToday = new Date(Math.floor((now.getTime() + IST_MS) / 86_400_000) * 86_400_000 - IST_MS);
  const since = (days: number) => new Date(startOfToday.getTime() - (days - 1) * 86_400_000);
  const sum = async (from: Date) => {
    const rows = await LedgerTransaction.aggregate<{ total: number }>([
      { $match: { kind: { $in: ["escrow_release", "video_tour_reversal"] }, createdAt: { $gte: from } } },
      { $unwind: "$lines" },
      { $match: { "lines.account": "platform_revenue" } },
      { $group: { _id: null, total: { $sum: "$lines.delta" } } },
    ]);
    return rows[0]?.total ?? 0;
  };
  const [today, week, month] = await Promise.all([sum(startOfToday), sum(since(7)), sum(since(30))]);
  return { today, week, month };
}
