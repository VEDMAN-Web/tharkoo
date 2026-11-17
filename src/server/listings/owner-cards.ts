import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { shownCountsFor } from "@/server/analytics/counts";
import { ownerView } from "@/server/listings/service";
import { DELETED_STATUSES, ownerFilter, type OwnerGroup } from "@/server/listings/owner-groups";
import { Listing } from "@/server/models/listing";
import { presentRows } from "@/server/search/query";
import { ENDING_SOON_MS } from "@/lib/ui/ad-status";

type PresentInput = Parameters<typeof presentRows>[0];

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
  const byAd = await shownCountsFor(owned.flatMap((row) => (row.slug ? [row.slug] : [])));
  // H7.5: each ad's own shown views and clicks (the owner's own visits are not counted, see the ad counters).
  const items = rows.map((row, index) => {
    const view = ownerView(row);
    const counts = view.slug ? byAd[view.slug] : undefined;
    return { ...view, card: legacy[index], shown: { views: counts?.views ?? 0, clicks: counts?.clicks ?? 0 } };
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
