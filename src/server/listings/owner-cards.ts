import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { shownCountsFor } from "@/server/analytics/counts";
import { ownerView } from "@/server/listings/service";
import { ownerFilter, type OwnerGroup } from "@/server/listings/owner-groups";
import { Listing } from "@/server/models/listing";
import { presentRows } from "@/server/search/query";

type PresentInput = Parameters<typeof presentRows>[0];

/** The most ads whose views and clicks the panel totals. Keeps one request bounded. */
const TOTALS_LIMIT = 500;

export interface OwnTotals {
  all: number;
  live: number;
  review: number;
  ended: number;
}

/**
 * H6.19: one page of the vendor panel's own ads. Each item carries the same card data the public category and
 * city pages use (`card`), plus the owner view (status, expiry). Paging is server side. The tab counts and the
 * all-time views and clicks are for every ad the owner has, not just this page.
 */
export async function listOwnCards(userId: string, query: { status?: string; group?: OwnerGroup; page: number; pageSize: number }) {
  await connectDb();
  const filter = ownerFilter(userId, query);
  const base = { ownerId: new Types.ObjectId(userId) };
  const [rows, total, owned] = await Promise.all([
    Listing.find(filter)
      .select("+contact")
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize),
    Listing.countDocuments(filter),
    Listing.find(base).select("status slug").limit(TOTALS_LIMIT).lean<{ status: string; slug?: string }[]>(),
  ]);
  const { legacy } = await presentRows(rows.map((row) => row.toObject()) as unknown as PresentInput, new Map(), new Date());
  const items = rows.map((row, index) => ({ ...ownerView(row), card: legacy[index] }));
  const shown = Object.values(await shownCountsFor(owned.flatMap((row) => (row.slug ? [row.slug] : []))));
  const totals = {
    views: shown.reduce((sum, item) => sum + item.views, 0),
    clicks: shown.reduce((sum, item) => sum + item.clicks, 0),
  };
  return { items, total, counts: ownTabCounts(owned.map((row) => row.status)), totals };
}

/** Counts for the tabs, from the statuses of every ad the owner has. */
export function ownTabCounts(statuses: readonly string[]): OwnTotals {
  const count = (list: readonly string[]) => statuses.filter((status) => list.includes(status)).length;
  return {
    all: statuses.length,
    live: count(["active"]),
    review: count(["pending"]),
    ended: count(["expired", "archived"]),
  };
}
