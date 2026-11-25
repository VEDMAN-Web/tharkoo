import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { shownCountsFor } from "@/server/analytics/counts";
import { ownerView } from "@/server/listings/service";
import { DELETED_STATUSES, ownerFilter, type OwnerGroup } from "@/server/listings/owner-groups";
import { Listing } from "@/server/models/listing";
import { PromotionOrder, PromotionProduct } from "@/server/models/billing";
import { presentRows } from "@/server/search/query";
import { ENDING_SOON_MS } from "@/lib/ui/ad-status";

type PresentInput = Parameters<typeof presentRows>[0];

const VIDEO_SWITCH_CODES = new Set(["top", "super-top"]);

/** A promotion running on an ad right now, for the label on its card in My ads. */
export interface RunningPromotion {
  code: string;
  name: string;
  endsAt: string;
}

/** Strongest first, the same order the lists use. A code not named here counts as the weakest. */
const STRENGTH = ["star", "super-top", "flash", "top", "highlight", "new", "auto-boost", "bump"];

/** The promotions running now on these ads (by id): one query for the orders and one for their plans. */
async function runningOrders(ids: Types.ObjectId[], now: Date) {
  if (ids.length === 0) return [] as { listingId: string; code: string; name: string; endsAt: Date }[];
  await connectDb();
  const orders = await PromotionOrder.find({ listingId: { $in: ids }, status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } }).select("listingId productId endsAt").lean();
  const products = await PromotionProduct.find({ _id: { $in: [...new Set(orders.map((order) => String(order.productId)))] } }).select("code name").lean();
  const byId = new Map(products.map((product) => [String(product._id), { code: String(product.code).toLowerCase(), name: String(product.name || product.code) }]));
  return orders.flatMap((order) => {
    const plan = byId.get(String(order.productId));
    return plan && order.endsAt ? [{ listingId: String(order.listingId), code: plan.code, name: plan.name, endsAt: new Date(order.endsAt) }] : [];
  });
}

const strength = (code: string) => {
  const index = STRENGTH.indexOf(code);
  return index < 0 ? STRENGTH.length : index;
};

/** H21.5c: the ads (by id) that have TOP or Super Top running now: only those can have the Video calls switch in My ads. */
export async function topAdIds(ids: Types.ObjectId[], now: Date) {
  const running = await runningOrders(ids, now);
  return new Set(running.filter((order) => VIDEO_SWITCH_CODES.has(order.code)).map((order) => order.listingId));
}

/** For each ad with a promotion running now, the strongest one (and when it ends), so My ads can say it is promoted. */
export async function runningPromotions(ids: Types.ObjectId[], now: Date) {
  const best = new Map<string, RunningPromotion>();
  for (const order of await runningOrders(ids, now)) {
    const held = best.get(order.listingId);
    const better = !held || strength(order.code) < strength(held.code) || (strength(order.code) === strength(held.code) && order.endsAt.toISOString() > held.endsAt);
    if (better) best.set(order.listingId, { code: order.code, name: order.name, endsAt: order.endsAt.toISOString() });
  }
  return best;
}

/** The most ads whose views and clicks the panel totals. Keeps one request bounded. */
const TOTALS_LIMIT = 500;

export interface OwnTotals {
  all: number;
  live: number;
  review: number;
  ended: number;
  draft: number;
  /** Live ads that end within the last day of their run. Only the full list from listOwnCards has it. */
  endingSoon?: number;
}

/**
 * H6.19: one page of the vendor panel's own ads. Each item carries the same card data the public category and
 * city pages use (`card`), plus the owner view (status, expiry). Paging is server side. The tab counts and the
 * all-time views and clicks are for every ad the owner has, not just this page.
 */
export async function listOwnCards(userId: string, query: { status?: string; group?: OwnerGroup; page: number; pageSize: number }) {
  await connectDb();
  const filter = ownerFilter(userId, query);
  const base = { ownerId: new Types.ObjectId(userId), status: { $nin: [...DELETED_STATUSES] } };
  const [rows, total, owned] = await Promise.all([
    Listing.find(filter)
      .select("+contact")
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize),
    Listing.countDocuments(filter),
    Listing.find(base).select("status slug expiresAt").limit(TOTALS_LIMIT).lean<{ status: string; slug?: string; expiresAt?: Date | null }[]>(),
  ]);
  const { legacy } = await presentRows(rows.map((row) => row.toObject()) as unknown as PresentInput, new Map(), new Date(), { ownerView: true });
  const rowIds = rows.map((row) => row._id as Types.ObjectId);
  const [topAds, promotions] = await Promise.all([topAdIds(rowIds, new Date()), runningPromotions(rowIds, new Date())]);
  const byAd = await shownCountsFor(owned.flatMap((row) => (row.slug ? [row.slug] : [])));
  // H7.5: each ad's own shown views and clicks (the owner's own visits are not counted, see the ad counters).
  const items = rows.map((row, index) => {
    const view = ownerView(row);
    const counts = view.slug ? byAd[view.slug] : undefined;
    return { ...view, videoCallsEligible: topAds.has(String(row._id)), promotion: promotions.get(String(row._id)) ?? null, card: legacy[index], shown: { views: counts?.views ?? 0, clicks: counts?.clicks ?? 0 } };
  });
  const shown = Object.values(byAd);
  const totals = {
    views: shown.reduce((sum, item) => sum + item.views, 0),
    clicks: shown.reduce((sum, item) => sum + item.clicks, 0),
  };
  const now = Date.now();
  const endingSoon = owned.filter((row) => row.status === "active" && row.expiresAt && new Date(row.expiresAt).getTime() - now <= ENDING_SOON_MS).length;
  return { items, total, counts: { ...ownTabCounts(owned.map((row) => row.status)), endingSoon }, totals };
}

/** Counts for the tabs, from the statuses of every ad the owner has. */
export function ownTabCounts(statuses: readonly string[]): OwnTotals {
  const count = (list: readonly string[]) => statuses.filter((status) => list.includes(status)).length;
  return {
    all: statuses.length,
    live: count(["active"]),
    review: count(["pending"]),
    ended: count(["expired", "archived"]),
    draft: count(["draft"]),
  };
}
