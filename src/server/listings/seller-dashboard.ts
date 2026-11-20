import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { LISTING_PAGE_SIZE } from "@/lib/listing-page-size";
import { getCategories, getCities } from "@/lib/queries";
import { AdCounter, AdEvent } from "@/server/models/ad-event";
import { Listing, PromotionOrder, PromotionProduct, User } from "@/server/models";
import { presentRows, queryListings } from "@/server/search/query";
import { DELETED_STATUSES } from "@/server/listings/owner-groups";
import { DAY, goalProgress, istWeekStart, lastDays, liftOf, milestonesFor, percentChange, type Goal, type Lift, type MilestoneRow } from "@/server/listings/dashboard-math";

/**
 * H14.3: every number on the seller dashboard, from one function. HARD RULE: the numbers are the real ones. Views and
 * clicks come from AdEvent (one row per visitor per ad) and from the real counters in AdCounter (realViews, realClicks),
 * never from the numbers an admin sets for display (viewsSet, clicksSet). The owner's own visits are not recorded as events.
 * Bounded: at most 200 ads, one event query over 14 days, one order query, and at most 5 ad rows with a rank.
 */
const ADS_CAP = 200;
const ROWS = 5;
const WINDOW_DAYS = 14;
const ENDS_SOON_DAYS = 3;
const LIFT_LOOKBACK_DAYS = 30;
const RANK_PAGES = 3;
const RANK_PAGE_SIZE = 100;
const STAR_SHOWN = 6;
const TOP_CODES = ["top", "super-top"];

export type DashboardDay = { key: string; label: string; views: number; clicks: number; topOn: boolean };
export type DashboardTrend = { kind: "boost"; times: number } | { kind: "percent"; percent: number } | null;
export type DashboardRank = { position: number; inWhat: string; page: number; above: number } | null;
export type DashboardAd = {
  id: string;
  slug: string;
  /** H16.2: the public address of the ad; left out while it has none. */
  address?: string;
  title: string;
  photo: string | null;
  where: string;
  status: "live" | "review";
  endsInDays: number | null;
  views: number;
  clicks: number;
  trend: DashboardTrend;
  rank: DashboardRank;
  boostLive: boolean;
  second: "bump" | "improve";
};
export type DashboardLift = (Lift & { adId: string; adTitle: string }) | null;
export type SellerDashboard = {
  hasAds: boolean;
  counts: { live: number; endsSoon: number; review: number; drafts: number; all: number };
  views: { total: number; previous: number; percent: number | null; spark: number[] };
  clicks: { total: number; previous: number; percent: number | null; spark: number[] };
  liveSpark: number[];
  days: DashboardDay[];
  lift: DashboardLift;
  ads: DashboardAd[];
  goal: Goal;
  milestones: MilestoneRow[];
  /** The id of the Bump plan, so the Bump button can open the promote sheet with it chosen. Null when there is none. */
  bumpPlanId: string | null;
};

type OwnRow = { _id: Types.ObjectId; title: string; slug?: string; status: string; expiresAt?: Date | null; publishedAt?: Date | null; createdAt?: Date };
type Cell = { views: number; clicks: number };

function emptyCell(): Cell {
  return { views: 0, clicks: 0 };
}

async function dailyCounts(ids: Types.ObjectId[], from: Date, now: Date) {
  const rows = await AdEvent.aggregate<{ _id: { listingId: Types.ObjectId; type: "view" | "click"; day: string }; n: number }>([
    { $match: { listingId: { $in: ids }, type: { $in: ["view", "click"] }, createdAt: { $gte: from, $lte: now } } },
    { $group: { _id: { listingId: "$listingId", type: "$type", day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } } }, n: { $sum: 1 } } },
  ]);
  const byAd = new Map<string, Map<string, Cell>>();
  for (const row of rows) {
    const ad = byAd.get(String(row._id.listingId)) ?? new Map<string, Cell>();
    const cell = ad.get(row._id.day) ?? emptyCell();
    if (row._id.type === "view") cell.views += row.n;
    else cell.clicks += row.n;
    ad.set(row._id.day, cell);
    byAd.set(String(row._id.listingId), ad);
  }
  return byAd;
}

async function topWindows(ids: Types.ObjectId[], since: Date) {
  const products = await PromotionProduct.find({ code: { $in: TOP_CODES } }).select("_id").lean<{ _id: Types.ObjectId }[]>();
  if (products.length === 0) return [];
  const orders = await PromotionOrder.find({ listingId: { $in: ids }, productId: { $in: products.map((row) => row._id) }, status: "active", endsAt: { $gt: since } })
    .select("listingId startsAt endsAt")
    .lean<{ listingId: Types.ObjectId; startsAt?: Date; endsAt?: Date }[]>();
  return orders.flatMap((order) => (order.startsAt && order.endsAt ? [{ listingId: String(order.listingId), startsAt: order.startsAt, endsAt: order.endsAt }] : []));
}

async function countViews(listingId: Types.ObjectId, from: Date, to: Date) {
  return AdEvent.countDocuments({ listingId, type: "view", createdAt: { $gte: from, $lt: to } });
}

/** The most recent TOP boost that ended in the last 30 days and has 7 days of the ad's own history before it. */
async function liftFor(rows: OwnRow[], windows: Awaited<ReturnType<typeof topWindows>>, now: Date): Promise<DashboardLift> {
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const oldest = now.getTime() - LIFT_LOOKBACK_DAYS * DAY;
  const picked = windows
    .filter((window) => window.endsAt <= now && window.endsAt.getTime() >= oldest)
    .filter((window) => {
      const since = byId.get(window.listingId)?.publishedAt ?? byId.get(window.listingId)?.createdAt;
      return since ? since.getTime() <= window.startsAt.getTime() - 7 * DAY : false;
    })
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  const ad = picked ? byId.get(picked.listingId) : undefined;
  if (!picked || !ad) return null;
  const [duringViews, beforeViews, sinceViews] = await Promise.all([
    countViews(ad._id, picked.startsAt, picked.endsAt),
    countViews(ad._id, new Date(picked.startsAt.getTime() - 7 * DAY), picked.startsAt),
    countViews(ad._id, picked.endsAt, now),
  ]);
  const lift = liftOf({ duringViews, duringMs: picked.endsAt.getTime() - picked.startsAt.getTime(), beforeViews, sinceViews, endsAt: picked.endsAt, now });
  return lift ? { ...lift, adId: String(ad._id), adTitle: ad.title } : null;
}

/** The place an ad has in its category and city, with the same query and the same default order the public page uses. */
async function rankFor(slug: string, categorySlug: string, citySlug: string, inWhat: string): Promise<DashboardRank> {
  if (!categorySlug || !citySlug) return null;
  const scope = { categorySlug, citySlug };
  const stars = await queryListings({ ...scope, starOnly: true, page: 1, pageSize: STAR_SHOWN });
  const starIndex = stars.legacy.findIndex((item) => item.slug === slug);
  if (starIndex >= 0) return { position: starIndex + 1, inWhat, page: 1, above: starIndex };
  const starsAbove = Math.min(stars.total, STAR_SHOWN);
  for (let page = 1; page <= RANK_PAGES; page += 1) {
    const feed = await queryListings({ ...scope, excludeStar: true, sort: "ranked", page, pageSize: RANK_PAGE_SIZE });
    const index = feed.legacy.findIndex((item) => item.slug === slug);
    if (index >= 0) {
      const inFeed = (page - 1) * RANK_PAGE_SIZE + index + 1;
      return { position: starsAbove + inFeed, inWhat, page: Math.ceil(inFeed / LISTING_PAGE_SIZE), above: starsAbove + inFeed - 1 };
    }
    if (feed.legacy.length < RANK_PAGE_SIZE) break;
  }
  return null;
}

export async function sellerDashboard(userId: string, now: Date = new Date()): Promise<SellerDashboard> {
  await connectDb();
  const owner = new Types.ObjectId(userId);
  const rows = await Listing.find({ ownerId: owner, status: { $nin: [...DELETED_STATUSES] } })
    .select("title slug status expiresAt publishedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(ADS_CAP)
    .lean<OwnRow[]>();
  const days = lastDays(now, WINDOW_DAYS);
  const ids = rows.map((row) => row._id);
  const live = rows.filter((row) => row.status === "active");
  const soonMs = now.getTime() + ENDS_SOON_DAYS * DAY;
  const counts = {
    live: live.length,
    endsSoon: live.filter((row) => row.expiresAt && row.expiresAt.getTime() <= soonMs).length,
    review: rows.filter((row) => row.status === "pending").length,
    drafts: rows.filter((row) => row.status === "draft").length,
    all: rows.length,
  };
  if (rows.length === 0) return emptyDashboard(counts, now);

  const [byAd, windows, counters, user, bump] = await Promise.all([
    dailyCounts(ids, days[0].start, now),
    topWindows(ids, days[0].start),
    AdCounter.find({ listingId: { $in: ids } }).select("realViews realClicks").lean<{ realViews?: number; realClicks?: number }[]>(),
    User.findById(owner).select("weeklyViewsGoal").lean<{ weeklyViewsGoal?: number } | null>(),
    PromotionProduct.findOne({ code: "bump", enabled: { $ne: false } }).select("_id").lean<{ _id: Types.ObjectId } | null>(),
  ]);
  const total = new Map<string, Cell>();
  for (const ad of byAd.values()) {
    for (const [day, cell] of ad) {
      const sum = total.get(day) ?? emptyCell();
      sum.views += cell.views;
      sum.clicks += cell.clicks;
      total.set(day, sum);
    }
  }
  const perDay = days.map((day) => ({ day, ...(total.get(day.key) ?? emptyCell()) }));
  const thisWeek = perDay.slice(7);
  const before = perDay.slice(0, 7);
  const sum = (list: { views: number; clicks: number }[], key: "views" | "clicks") => list.reduce((acc, item) => acc + item[key], 0);
  const topOn = (start: Date) => windows.some((window) => window.startsAt.getTime() < start.getTime() + DAY && window.endsAt.getTime() > start.getTime());
  const weekStart = istWeekStart(now).getTime();
  const lastWeekStart = weekStart - 7 * DAY;
  const inRange = (from: number, to: number, key: "views" | "clicks") => sum(perDay.filter((item) => item.day.start.getTime() >= from && item.day.start.getTime() < to), key);
  const liveOn = (start: Date) => {
    const end = start.getTime() + DAY;
    return rows.filter((row) => row.status !== "draft" && (row.publishedAt ?? row.createdAt)!.getTime() < end && (!row.expiresAt || row.expiresAt.getTime() > start.getTime())).length;
  };
  const lift = await liftFor(rows, windows, now);
  const top = await adRows(rows, live, byAd, days, windows, lift, now);
  return {
    hasAds: true,
    counts,
    views: { total: sum(thisWeek, "views"), previous: sum(before, "views"), percent: percentChange(sum(thisWeek, "views"), sum(before, "views")), spark: thisWeek.map((item) => item.views) },
    clicks: { total: sum(thisWeek, "clicks"), previous: sum(before, "clicks"), percent: percentChange(sum(thisWeek, "clicks"), sum(before, "clicks")), spark: thisWeek.map((item) => item.clicks) },
    liveSpark: days.slice(7).map((day) => liveOn(day.start)),
    days: thisWeek.map((item) => ({ key: item.day.key, label: item.day.label, views: item.views, clicks: item.clicks, topOn: topOn(item.day.start) })),
    lift,
    ads: top,
    goal: goalProgress({ saved: user?.weeklyViewsGoal, weekViews: inRange(weekStart, weekStart + 7 * DAY, "views"), lastWeekViews: inRange(lastWeekStart, weekStart, "views"), now }),
    milestones: milestonesFor({ views: counters.reduce((acc, row) => acc + (row.realViews ?? 0), 0), clicks: counters.reduce((acc, row) => acc + (row.realClicks ?? 0), 0) }),
    bumpPlanId: bump ? String(bump._id) : null,
  };
}

function emptyDashboard(counts: SellerDashboard["counts"], now: Date): SellerDashboard {
  return {
    hasAds: false,
    counts,
    views: { total: 0, previous: 0, percent: null, spark: [] },
    clicks: { total: 0, previous: 0, percent: null, spark: [] },
    liveSpark: [],
    days: lastDays(now, 7).map((day) => ({ key: day.key, label: day.label, views: 0, clicks: 0, topOn: false })),
    lift: null,
    ads: [],
    goal: goalProgress({ saved: null, weekViews: 0, lastWeekViews: 0, now }),
    milestones: milestonesFor({ views: 0, clicks: 0 }),
    bumpPlanId: null,
  };
}

async function adRows(
  rows: OwnRow[],
  live: OwnRow[],
  byAd: Map<string, Map<string, Cell>>,
  days: ReturnType<typeof lastDays>,
  windows: Awaited<ReturnType<typeof topWindows>>,
  lift: DashboardLift,
  now: Date,
): Promise<DashboardAd[]> {
  const weekKeys = new Set(days.slice(7).map((day) => day.key));
  const beforeKeys = new Set(days.slice(0, 7).map((day) => day.key));
  const cellsFor = (id: string, keys: Set<string>) => {
    let views = 0;
    let clicks = 0;
    for (const [day, cell] of byAd.get(id) ?? []) {
      if (!keys.has(day)) continue;
      views += cell.views;
      clicks += cell.clicks;
    }
    return { views, clicks };
  };
  const shown = [...live, ...rows.filter((row) => row.status === "pending")]
    .map((row) => ({ row, week: cellsFor(String(row._id), weekKeys), before: cellsFor(String(row._id), beforeKeys) }))
    .sort((a, b) => b.week.views - a.week.views || a.row.title.localeCompare(b.row.title))
    .slice(0, ROWS);
  if (shown.length === 0) return [];
  const full = await Listing.find({ _id: { $in: shown.map((item) => item.row._id) } }).select("+contact").lean();
  const presented = await presentRows(full as unknown as Parameters<typeof presentRows>[0], new Map(), now, { ownerView: true });
  const cardOf = new Map(presented.legacy.map((card) => [card.slug, card]));
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  const categoryName = new Map(categories.map((item) => [item.slug, item.name]));
  const cityName = new Map(cities.map((item) => [item.slug, item.name]));
  return Promise.all(
    shown.map(async ({ row, week, before }) => {
      const card = row.slug ? cardOf.get(row.slug) : undefined;
      const category = categoryName.get(card?.categorySlug ?? "") ?? "";
      const city = cityName.get(card?.citySlug ?? "") ?? "";
      const isLive = row.status === "active";
      const boostLive = windows.some((window) => window.listingId === String(row._id) && window.startsAt <= now && window.endsAt > now);
      const percent = percentChange(week.views, before.views);
      const boosted = lift && lift.adId === String(row._id) ? { kind: "boost" as const, times: lift.times } : null;
      return {
        id: String(row._id),
        slug: row.slug ?? "",
        ...(card?.address ? { address: card.address } : {}),
        title: row.title,
        photo: card?.photos?.[0] ?? null,
        where: [category, city].filter(Boolean).join(" · "),
        status: isLive ? ("live" as const) : ("review" as const),
        endsInDays: isLive && row.expiresAt && row.expiresAt.getTime() - now.getTime() <= ENDS_SOON_DAYS * DAY ? Math.max(0, Math.ceil((row.expiresAt.getTime() - now.getTime()) / DAY)) : null,
        views: week.views,
        clicks: week.clicks,
        trend: boosted ?? (percent === null ? null : { kind: "percent" as const, percent }),
        rank: isLive && row.slug ? await rankFor(row.slug, card?.categorySlug ?? "", card?.citySlug ?? "", [category, city].filter(Boolean).join(", ")) : null,
        boostLive,
        second: percent !== null && percent > 0 && week.views >= 5 ? ("bump" as const) : ("improve" as const),
      };
    }),
  );
}

/** Saves the weekly goal on the user. The caller has checked the number with cleanGoal. */
export async function saveWeeklyGoal(userId: string, goal: number): Promise<void> {
  await connectDb();
  await User.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { weeklyViewsGoal: goal } });
}

