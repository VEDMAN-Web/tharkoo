import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { demoAdCounts, demoFilter } from "@/server/listings/demo-ads";
import { AuditEvent, Listing, Payment, User } from "@/server/models";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days are counted in Indian time (UTC+05:30, no daylight saving). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_OFFSET_LABEL = "+05:30";
const SERIES_DAYS = 30;
const NOT_COUNTED_AS_NEW = ["draft", "deleted"];
const RECENT_LIMIT = 5;

export interface DashboardDay {
  date: string;
  count: number;
}

export interface RecentChange {
  id: string;
  summary: string;
  who: string;
  label: string;
  at: string;
  undoable: boolean;
  lock: string | null;
}

export interface DashboardData {
  liveAds: number;
  newAdsToday: number;
  newUsersToday: number;
  sales: { rupees: number; credits: number; orders: number; testOrders: number };
  newAdsPerDay: DashboardDay[];
  demoActive: number;
  recent: RecentChange[];
}

export function dayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** First instant of the Indian calendar day that is `daysBack` days before the day of `now`. */
export function dayStart(now: Date, daysBack: number): Date {
  const dayZeroIst = Date.parse(`${dayKey(now)}T00:00:00.000Z`) - IST_OFFSET_MS;
  return new Date(dayZeroIst - daysBack * DAY_MS);
}

async function newAdsPerDay(now: Date, real: object): Promise<DashboardDay[]> {
  const from = dayStart(now, SERIES_DAYS - 1);
  const rows = await Listing.aggregate<{ _id: string; n: number }>([
    { $match: { ...real, createdAt: { $gte: from }, status: { $nin: NOT_COUNTED_AS_NEW } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: IST_OFFSET_LABEL } }, n: { $sum: 1 } } },
  ]);
  const counts = new Map(rows.map((row) => [row._id, row.n]));
  return Array.from({ length: SERIES_DAYS }, (_, index) => {
    const date = dayKey(new Date(from.getTime() + index * DAY_MS + DAY_MS / 2));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** What was sold today. A test order (provider "mock") is counted apart and never added to the sales. */
export async function salesToday(now: Date): Promise<DashboardData["sales"]> {
  await connectDb();
  const from = dayStart(now, 0);
  const rows = await Payment.find({ status: "paid", updatedAt: { $gte: from } }).select("provider amount credits").lean<{ provider?: string; amount?: number; credits?: number }[]>();
  const sales = { rupees: 0, credits: 0, orders: 0, testOrders: 0 };
  for (const row of rows) {
    if (row.provider === "mock") {
      sales.testOrders += 1;
      continue;
    }
    sales.orders += 1;
    sales.rupees += row.amount ?? 0;
    sales.credits += row.credits ?? 0;
  }
  return sales;
}

/** The last admin changes, newest first, with whether the Undo button may show (window open, not locked, not already undone). */
export async function recentChanges(now: Date, limit = RECENT_LIMIT): Promise<RecentChange[]> {
  await connectDb();
  const rows = await AuditEvent.find({ summary: { $exists: true, $ne: "" }, action: { $ne: "admin.write.denied" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<{ _id: Types.ObjectId; actorId?: Types.ObjectId | null; summary?: string; targetLabel?: string; createdAt?: Date; undo?: { until?: Date }; lock?: string; undoOf?: Types.ObjectId }[]>();
  if (rows.length === 0) return [];
  const [actors, undone] = await Promise.all([
    User.find({ _id: { $in: rows.flatMap((row) => (row.actorId ? [row.actorId] : [])) } }).select("displayName").lean<{ _id: Types.ObjectId; displayName?: string }[]>(),
    AuditEvent.find({ undoOf: { $in: rows.map((row) => row._id) } }).select("undoOf").lean<{ undoOf?: Types.ObjectId }[]>(),
  ]);
  const names = new Map(actors.map((actor) => [String(actor._id), actor.displayName ?? "Staff"]));
  const done = new Set(undone.map((row) => String(row.undoOf)));
  return rows.map((row) => ({
    id: String(row._id),
    summary: row.summary ?? "",
    who: row.actorId ? (names.get(String(row.actorId)) ?? "Staff") : "The system",
    label: row.targetLabel ?? "",
    at: (row.createdAt ?? now).toISOString(),
    undoable: Boolean(row.undo?.until && row.undo.until.getTime() > now.getTime() && !row.lock && !row.undoOf && !done.has(String(row._id))),
    lock: row.lock ?? null,
  }));
}

/** Real numbers for the admin dashboard. Demo ads are left out of every figure; a test payment is left out of sales. */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  await connectDb();
  const demo = await demoFilter();
  const real = demo ? { $nor: [demo] } : {};
  const today = dayStart(now, 0);
  const [liveAds, series, newUsersToday, sales, demoCounts, recent] = await Promise.all([
    Listing.countDocuments({ ...real, status: "active" }),
    newAdsPerDay(now, real),
    User.countDocuments({ createdAt: { $gte: today } }),
    salesToday(now),
    demoAdCounts(),
    recentChanges(now),
  ]);
  return {
    liveAds,
    newAdsToday: series[series.length - 1]?.count ?? 0,
    newUsersToday,
    sales,
    newAdsPerDay: series,
    demoActive: demoCounts.active,
    recent,
  };
}
