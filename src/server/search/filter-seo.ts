/**
 * Rules for filter URLs and indexable listing pages. Pure: no database, no request object.
 * A filter is a query parameter that changes what a listing shows. Tracking parameters are not filters.
 */

export type ListingParams = Record<string, string | string[] | undefined>;

/** Parameters that only mark where a visitor came from. They never make a page a filter page. */
const TRACKING_PARAM = /^(utm_[a-z]+|gclid|fbclid|msclkid)$/i;
/** Pagination is not a filter: page 2 of an unfiltered listing keeps its own canonical. */
const NOT_FILTER_PARAM = new Set(["page"]);
const FIELD_PARAM = /^f\.([a-z][a-z0-9_]{0,40})$/;
export const MAX_PICKS_PER_FILTER = 20;
const MAX_VALUE_LENGTH = 200;

function hasValue(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) return value.some((item) => typeof item === "string" && item.trim() !== "");
  return typeof value === "string" && value.trim() !== "";
}

/** The filter parameters on a listing URL, sorted. Empty values and tracking parameters are left out. */
export function activeFilterKeys(params: ListingParams): string[] {
  return Object.keys(params)
    .filter((key) => !TRACKING_PARAM.test(key) && !NOT_FILTER_PARAM.has(key) && hasValue(params[key]))
    .sort();
}

/**
 * The query string a listing page names as its canonical. Filters are left out, so every filter URL points at the
 * clean page. Pagination stays on unfiltered pages only.
 */
export function listingCanonicalSuffix(params: ListingParams, page: number): string {
  if (activeFilterKeys(params).length > 0 || page <= 1) return "";
  return `?page=${page}`;
}

/** Robots for a listing URL. Any filter makes the page noindex, follow, so its links still count. */
export function listingRobots(params: ListingParams): { index: boolean; follow: boolean } {
  return { index: activeFilterKeys(params).length === 0, follow: true };
}

export type ListingPageKind = "category" | "category-city" | "category-city-area";

/** The three page types that may be indexed and listed in the sitemap. An area without a city is not one of them. */
export function indexableListingKind(place: { city?: string | null; area?: string | null }): ListingPageKind | null {
  if (place.area && !place.city) return null;
  if (place.area) return "category-city-area";
  if (place.city) return "category-city";
  return "category";
}

/** True only for one of the three page types, reached with no filter. */
export function isIndexableListing(place: { city?: string | null; area?: string | null }, params: ListingParams): boolean {
  return indexableListingKind(place) !== null && activeFilterKeys(params).length === 0;
}

/**
 * The field filters on a listing URL: `f.<fieldKey>=<option>` repeated for each pick. Keys that are not field keys
 * and values that are too long are dropped; at most MAX_PICKS_PER_FILTER picks are kept per field.
 */
export function parseFieldFilters(params: ListingParams): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of Object.keys(params)) {
    const match = FIELD_PARAM.exec(key);
    if (!match) continue;
    const raw = params[key];
    const values = (Array.isArray(raw) ? raw : [raw]).filter((value): value is string => typeof value === "string");
    const picks = values
      .map((value) => value.trim())
      .filter((value) => value !== "" && value.length <= MAX_VALUE_LENGTH)
      .slice(0, MAX_PICKS_PER_FILTER);
    if (picks.length > 0) out[match[1]] = picks;
  }
  return out;
}
