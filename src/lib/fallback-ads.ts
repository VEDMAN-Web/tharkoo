import { cached } from "@/lib/cache";
import type { ListingDoc } from "@/lib/models";
import type { TextFn } from "@/lib/ui/text";
import { queryListings } from "@/server/search";
import { LISTING_PAGE_SIZE } from "@/lib/listing-page-size";

/**
 * H7.32 (FIX B): fallback ads for a page whose own results are few. Real live ads only, each card keeps its own
 * city. Below FALLBACK_OWN_MINIMUM own results the page keeps them and adds sections below; the page never shows
 * an empty result. The fallback ads do not count as the page's own content (SEO).
 */

/** A page with fewer own results than this gets fallback sections. */
export const FALLBACK_OWN_MINIMUM = 8;
/** A page shows at most this many ad cards: its own results plus the fallback ads. */
export const FALLBACK_TOTAL = LISTING_PAGE_SIZE;

export type FallbackKey = "nearby" | "category" | "latest";

export type FallbackScope = {
  /** The page's category, when it has one. */
  categorySlug?: string;
  /** The category's display name, used in the heading "{Category} ads across India". */
  categoryName?: string;
  /** The state the page is in, when it is known. */
  stateSlug?: string;
  /** The place the visitor is on or searched for (a city or a state), used in the "More ads near" heading. */
  placeName?: string;
};

export type FallbackSection<T> = { key: FallbackKey; title: string; items: T[] };

type Placed = { slug?: string; stateSlug?: string };

export function showFallback(feed: { page: number; pages: number; items: readonly unknown[] }): boolean {
  return feed.page >= feed.pages && feed.items.length < FALLBACK_OWN_MINIMUM;
}

/** How many fallback cards a page may add: none at 8 or more own results, otherwise enough for 15 in total. */
export function fallbackBudget(ownCount: number): number {
  if (ownCount >= FALLBACK_OWN_MINIMUM) return 0;
  return Math.max(0, FALLBACK_TOTAL - Math.max(0, ownCount));
}

/** Ads from the same state come before the rest, keeping the order they came in. */
function sameStateFirst<T extends Placed>(items: readonly T[], stateSlug?: string): T[] {
  if (!stateSlug) return [...items];
  return [...items.filter((ad) => ad.stateSlug === stateSlug), ...items.filter((ad) => ad.stateSlug !== stateSlug)];
}

/**
 * Pure: fills the sections in order from the sources, skipping ads already shown (own results or an earlier
 * section), and stops at the budget. A section with no ads left is left out.
 */
export function composeFallback<T extends Placed>(input: {
  budget: number;
  ownSlugs: readonly string[];
  stateSlug?: string;
  sources: readonly { key: FallbackKey; title: string; items: readonly T[] }[];
}): FallbackSection<T>[] {
  const seen = new Set(input.ownSlugs);
  const sections: FallbackSection<T>[] = [];
  let left = input.budget;
  for (const source of input.sources) {
    if (left <= 0) break;
    const picked: T[] = [];
    for (const ad of sameStateFirst(source.items, input.stateSlug)) {
      if (picked.length >= left) break;
      if (!ad.slug || seen.has(ad.slug)) continue;
      seen.add(ad.slug);
      picked.push(ad);
    }
    if (picked.length === 0) continue;
    left -= picked.length;
    sections.push({ key: source.key, title: source.title, items: picked });
  }
  return sections;
}

/** The live ads for one filter, newest first. Cached like the other listing feeds. */
function latestAds(filter: { categorySlug?: string; stateSlug?: string }, size: number): Promise<ListingDoc[]> {
  return cached(
    `fallback:${JSON.stringify([filter, size])}`,
    60_000,
    async () => {
      const result = await queryListings({ ...filter, page: 1, pageSize: size, sort: "fresh" });
      return result.legacy as ListingDoc[];
    },
    ["feed", "listings"],
    true,
  ).catch(() => []);
}

/**
 * The fallback sections for a page, in order: "More ads near {place}" (same category, same state), "{Category} ads
 * across India" (same category, any city), "Latest ads on Tharkoo" (any category, any city). Empty when the page
 * has enough own results.
 */
export async function loadFallbackSections(input: {
  scope: FallbackScope;
  ownSlugs: readonly string[];
  /** The page's UI text function, so the section titles can be edited in Menus & site text. Without it the built-in words are used. */
  t?: TextFn;
}): Promise<FallbackSection<ListingDoc>[]> {
  const budget = fallbackBudget(input.ownSlugs.length);
  if (budget === 0) return [];
  // One extra page's worth covers the ads the page already shows, so the budget can still be filled.
  const size = budget + input.ownSlugs.length;
  const { categorySlug, categoryName, stateSlug, placeName } = input.scope;
  const [nearby, category, latest] = await Promise.all([
    stateSlug ? latestAds({ stateSlug, categorySlug }, size) : Promise.resolve([]),
    categorySlug ? latestAds({ categorySlug }, size) : Promise.resolve([]),
    latestAds({}, size),
  ]);
  return composeFallback<ListingDoc>({
    budget,
    ownSlugs: input.ownSlugs,
    stateSlug,
    sources: [
      { key: "nearby", title: input.t ? input.t("listing.fallback.nearby", { place: placeName || stateSlug || "" }) : `More ads near ${placeName || stateSlug}`, items: nearby },
      { key: "category", title: input.t ? input.t("listing.fallback.category", { category: categoryName || categorySlug || "" }) : `${categoryName || categorySlug} ads across India`, items: category },
      { key: "latest", title: input.t ? input.t("listing.fallback.latest") : "Latest ads on Tharkoo", items: latest },
    ],
  });
}
