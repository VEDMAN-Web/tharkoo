import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditEvent, Category, IdentityVerification, Listing, Location, PromotionOrder, Report, User } from "@/server/models";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days are counted in Indian time (UTC+05:30, no daylight saving). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_OFFSET_LABEL = "+05:30";
const SERIES_DAYS = 30;
const TOP_N = 10;
const NOT_COUNTED_AS_NEW = ["draft", "deleted"];
const DEMO_SLUG = /^demo-\d{4}$/;
const REVEAL_ACTION = "listing.contact_reveal";

export interface DashboardBar {
  label: string;
  value: number;
}

export interface DashboardDay {
  date: string;
  count: number;
}

export interface DashboardData {
  kpis: {
    liveAds: number;
    pendingModeration: number;
    newAdsToday: number;
    newAds7d: number;
    newUsers7d: number;
    idChecksWaiting: number;
    openReports: number;
    /** null when no contact reveal has ever been logged. */
    contactReveals7d: number | null;
    promotionsActive: number;
  };
  adsByCategory: DashboardBar[];
  adsByCity: DashboardBar[];
  newAdsPerDay: DashboardDay[];
  demoListings: number;
}

function dayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** First instant of the Indian calendar day that is `daysBack` days before the day of `now`. */
function dayStart(now: Date, daysBack: number): Date {
  const dayZeroIst = Date.parse(`${dayKey(now)}T00:00:00.000Z`) - IST_OFFSET_MS;
  return new Date(dayZeroIst - daysBack * DAY_MS);
}

async function adsByPlace(field: "categoryId" | "cityId"): Promise<DashboardBar[]> {
  const rows = await Listing.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: "active", [field]: { $exists: true, $ne: null } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: TOP_N },
  ]);
  if (!rows.length) return [];
  const ids = rows.map((row) => row._id);
  const names =
    field === "categoryId"
      ? await Category.find({ _id: { $in: ids } }).select("name").lean()
      : await Location.find({ _id: { $in: ids } }).select("name").lean();
  const nameById = new Map(names.map((row) => [String(row._id), row.name]));
  return rows.map((row) => ({ label: nameById.get(String(row._id)) ?? "Unknown", value: row.n }));
}

async function newAdsPerDay(now: Date): Promise<DashboardDay[]> {
  const from = dayStart(now, SERIES_DAYS - 1);
  const rows = await Listing.aggregate<{ _id: string; n: number }>([
    { $match: { createdAt: { $gte: from }, status: { $nin: NOT_COUNTED_AS_NEW } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: IST_OFFSET_LABEL } },
        n: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map(rows.map((row) => [row._id, row.n]));
  return Array.from({ length: SERIES_DAYS }, (_, index) => {
    const date = dayKey(new Date(from.getTime() + index * DAY_MS + DAY_MS / 2));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** Real numbers for the admin dashboard. Every figure is a direct database count. */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  await connectDb();
  const weekStart = dayStart(now, 6);
  const [
    liveAds,
    pendingModeration,
    series,
    newUsers7d,
    idChecksWaiting,
    openReports,
    reveals7d,
    revealsEver,
    promotionsActive,
    adsByCategory,
    adsByCity,
    demoListings,
  ] = await Promise.all([
    Listing.countDocuments({ status: "active" }),
    Listing.countDocuments({ status: "pending" }),
    newAdsPerDay(now),
    User.countDocuments({ createdAt: { $gte: weekStart } }),
    IdentityVerification.countDocuments({ status: "pending_review" }),
    Report.countDocuments({ status: "open" }),
    AuditEvent.countDocuments({ action: REVEAL_ACTION, createdAt: { $gte: weekStart } }),
    AuditEvent.countDocuments({ action: REVEAL_ACTION }),
    PromotionOrder.countDocuments({
      status: "active",
      $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gt: now } }],
    }),
    adsByPlace("categoryId"),
    adsByPlace("cityId"),
    Listing.countDocuments({ slug: DEMO_SLUG, status: { $ne: "deleted" } }),
  ]);
  const sum = (days: DashboardDay[]) => days.reduce((total, day) => total + day.count, 0);
  return {
    kpis: {
      liveAds,
      pendingModeration,
      newAdsToday: series[series.length - 1]?.count ?? 0,
      newAds7d: sum(series.slice(-7)),
      newUsers7d,
      idChecksWaiting,
      openReports,
      contactReveals7d: revealsEver > 0 ? reveals7d : null,
      promotionsActive,
    },
    adsByCategory,
    adsByCity,
    newAdsPerDay: series,
    demoListings,
  };
}
