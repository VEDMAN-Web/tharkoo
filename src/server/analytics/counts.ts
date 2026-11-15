import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AdCounter } from "@/server/models/ad-event";
import { Listing } from "@/server/models/listing";
import { shownFrom, type ShownCounts } from "@/server/analytics/shown";

const CACHE_MS = 15_000;
const CACHE_LIMIT = 500;
const cache = new Map<string, { at: number; items: Record<string, ShownCounts> }>();

/** Shown counts (admin set + real since then) for ad slugs. Unknown slugs are left out. */
export async function shownCountsFor(slugs: string[]): Promise<Record<string, ShownCounts>> {
  if (slugs.length === 0) return {};
  await connectDb();
  const listings = await Listing.find({ slug: { $in: slugs } })
    .select("_id slug")
    .lean<{ _id: Types.ObjectId; slug?: string }[]>();
  const counters = await AdCounter.find({ listingId: { $in: listings.map((row) => row._id) } }).lean();
  const byId = new Map(counters.map((row) => [String(row.listingId), row]));
  const items: Record<string, ShownCounts> = {};
  for (const listing of listings) {
    if (!listing.slug) continue;
    items[listing.slug] = shownFrom(byId.get(String(listing._id)));
  }
  return items;
}

/** The same as shownCountsFor, cached for 15 seconds per slug list. Keeps the 30 second live refresh light. */
export async function cachedShownCounts(slugs: string[]): Promise<Record<string, ShownCounts>> {
  await connectDb();
  const key = [...slugs].sort().join(",");
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.items;
  const items = await shownCountsFor(slugs);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, { at: now, items });
  return items;
}

/** Real counts, never the shown ones. For advertiser statistics, promotion reports and the dashboard. */
export async function realCountsFor(listingIds: Types.ObjectId[]): Promise<Map<string, { views: number; clicks: number }>> {
  await connectDb();
  const counters = await AdCounter.find({ listingId: { $in: listingIds } }).select("listingId realViews realClicks").lean();
  return new Map(counters.map((row) => [String(row.listingId), { views: row.realViews ?? 0, clicks: row.realClicks ?? 0 }]));
}
