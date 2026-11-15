import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { queryListings, type SearchResult } from "@/server/search";

/**
 * H7.6: the "Discover ads" feed under the user panel and the chats screen.
 *
 * Rules (relay #62):
 * - the same visibility as the public listing pages (queryListings already applies it);
 * - random order, fixed by a seed per visit, so paging never repeats or skips an ad;
 * - the viewer's own ads are left out;
 * - a short in-memory cache of the candidate pool (60 seconds).
 */

export const DISCOVER_PAGE_SIZE = 12;
/** The biggest pool queryListings returns in one call. Paging runs over this pool. */
export const DISCOVER_POOL_SIZE = 100;
export const DISCOVER_MAX_PAGE = 50;
const POOL_TTL_MS = 60_000;
const POOL_CACHE_LIMIT = 200;

export type DiscoverFilters = {
  categorySlug?: string;
  citySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  withVideo?: boolean;
};

export type FeedCard = {
  id: string;
  publicId: string;
  slug: string;
  title: string;
  description: string;
  place: string;
  categorySlug: string;
  citySlug: string;
  price: number | null;
  photos: string[];
  variant: string;
  verified: boolean;
  videoVerifiedUntil: string | null;
};

export type DiscoverPage = {
  items: FeedCard[];
  page: number;
  hasMore: boolean;
  seed: string;
};

/** FNV-1a, 32 bit. Turns the seed text into a number for the shuffle. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small seeded generator (mulberry32). The same seed always gives the same sequence. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a new array in a seeded random order. The input is not changed. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const random = seededRandom(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function clampPage(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return 1;
  return Math.min(DISCOVER_MAX_PAGE, Math.max(1, Math.floor(raw)));
}

/** True when the card passes the price range and the "with video" switch. Missing price never passes a price range. */
export function matchesFilters(card: FeedCard, filters: DiscoverFilters, now: Date = new Date()): boolean {
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    if (card.price === null) return false;
    if (filters.minPrice !== undefined && card.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && card.price > filters.maxPrice) return false;
  }
  if (filters.withVideo) {
    const until = card.videoVerifiedUntil ? new Date(card.videoVerifiedUntil).getTime() : 0;
    if (!until || until <= now.getTime()) return false;
  }
  return true;
}

/** Shuffles the feed. When a city is given, ads in that city come first (each group keeps the seeded order). */
export function arrangeFeed(items: readonly FeedCard[], seed: string, leanCitySlug?: string): FeedCard[] {
  const shuffled = seededShuffle(items, seed);
  if (!leanCitySlug) return shuffled;
  return [
    ...shuffled.filter((card) => card.citySlug === leanCitySlug),
    ...shuffled.filter((card) => card.citySlug !== leanCitySlug),
  ];
}

export function pageOf<T>(items: readonly T[], page: number, size: number = DISCOVER_PAGE_SIZE) {
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), hasMore: start + size < items.length };
}

/** Pure: turns the search result and the viewer's own listing ids into the feed for one page. */
export function buildFeedPage(input: {
  pool: readonly FeedCard[];
  ownIds: ReadonlySet<string>;
  filters: DiscoverFilters;
  seed: string;
  page: number;
  now?: Date;
}): DiscoverPage {
  const eligible = input.pool.filter((card) => !input.ownIds.has(card.id) && matchesFilters(card, input.filters, input.now));
  const arranged = arrangeFeed(eligible, input.seed, input.filters.citySlug);
  const page = clampPage(input.page);
  const slice = pageOf(arranged, page);
  return { items: slice.items, page, hasMore: slice.hasMore, seed: input.seed };
}

type Legacy = SearchResult["legacy"][number];
type Hit = SearchResult["hits"][number];

/** Hits and legacy rows are built in the same loop, so they line up by index. */
function cardOf(hit: Hit | undefined, legacy: Legacy | undefined): FeedCard | null {
  if (!hit || !legacy || !hit.id) return null;
  return {
    id: hit.id,
    publicId: legacy.publicId ?? hit.publicId,
    slug: legacy.slug ?? "",
    title: legacy.title ?? "",
    description: legacy.description ?? "",
    place: legacy.place ?? "",
    categorySlug: legacy.categorySlug ?? "",
    citySlug: legacy.citySlug ?? "",
    price: hit.price ?? null,
    photos: legacy.photos ?? [],
    variant: legacy.variant ?? "free",
    verified: Boolean(legacy.verified),
    videoVerifiedUntil: legacy.videoVerifiedUntil ? new Date(legacy.videoVerifiedUntil).toISOString() : null,
  };
}

type CachedPool = { at: number; items: FeedCard[] };
const poolCache = new Map<string, CachedPool>();

function rememberPool(key: string, items: FeedCard[], now: number) {
  if (poolCache.size >= POOL_CACHE_LIMIT) {
    const oldest = poolCache.keys().next().value;
    if (oldest !== undefined) poolCache.delete(oldest);
  }
  poolCache.set(key, { at: now, items });
}

async function candidatePool(filters: DiscoverFilters): Promise<FeedCard[]> {
  const key = `${filters.categorySlug ?? ""}|${filters.citySlug ?? ""}`;
  const now = Date.now();
  const hit = poolCache.get(key);
  if (hit && now - hit.at < POOL_TTL_MS) return hit.items;
  const result = await queryListings({
    categorySlug: filters.categorySlug,
    citySlug: filters.citySlug,
    sort: "fresh",
    page: 1,
    pageSize: DISCOVER_POOL_SIZE,
  });
  const items = result.hits
    .map((hitRow, index) => cardOf(hitRow, result.legacy[index]))
    .filter((card): card is FeedCard => card !== null);
  rememberPool(key, items, now);
  return items;
}

/** Loads one page of the Discover feed. The viewer's own ads are never returned. */
export async function loadDiscoverFeed(input: {
  filters: DiscoverFilters;
  seed: string;
  page: number;
  viewerId?: string;
}): Promise<DiscoverPage> {
  await connectDb();
  const pool = await candidatePool(input.filters);
  const ownIds = new Set<string>();
  if (input.viewerId) {
    const own = await Listing.find({ ownerId: input.viewerId }).select("_id").lean<{ _id: { toString(): string } }[]>();
    for (const row of own) ownIds.add(String(row._id));
  }
  return buildFeedPage({ pool, ownIds, filters: input.filters, seed: input.seed, page: input.page });
}

/** Test helper: empties the candidate pool cache. */
export function clearDiscoverCache() {
  poolCache.clear();
}
