/**
 * H17.4: the two link lists under a listing page, built only from places and pages that really exist.
 * "Nearby" are other cities of the SAME state (never another state). "Popular searches" are category + city pages that have ads.
 */

export type CityRow = { slug?: string | null; name?: string | null; stateSlug?: string | null };
export type CountRow = { _id: { categorySlug: string; citySlug: string }; n: number };
export type PopularLink = { categorySlug: string; citySlug: string; categoryName: string; cityName: string; n: number };

/**
 * Cities of the same state as `current`, the ones with the most live ads in `categorySlug` first, then by name.
 * With no state known there is nothing near that can be named, so the list is empty.
 */
export function nearbyCities(current: CityRow, cities: readonly CityRow[], counts: readonly CountRow[], categorySlug: string, max = 5): CityRow[] {
  if (!current.stateSlug) return [];
  const live = new Map<string, number>();
  for (const row of counts) if (row._id.categorySlug === categorySlug) live.set(row._id.citySlug, (live.get(row._id.citySlug) ?? 0) + row.n);
  return cities
    .filter((city) => city.slug && city.slug !== current.slug && city.stateSlug === current.stateSlug)
    .sort((a, b) => (live.get(b.slug ?? "") ?? 0) - (live.get(a.slug ?? "") ?? 0) || (a.name ?? "").localeCompare(b.name ?? ""))
    .slice(0, max);
}

/**
 * The category + city pages with the most ads, as links. `exclude` leaves out the page being shown (and, with `excludeCategory`,
 * every page of that category). Each city appears once, so the list is varied.
 */
export function popularSearches(
  counts: readonly CountRow[],
  categoryNames: ReadonlyMap<string, string>,
  cityNames: ReadonlyMap<string, string>,
  options: { excludeCategory?: string; excludePage?: { categorySlug: string; citySlug: string }; max?: number } = {},
): PopularLink[] {
  const seenCity = new Set<string>();
  const out: PopularLink[] = [];
  const ranked = counts.filter((row) => row.n > 0).sort((a, b) => b.n - a.n || `${a._id.categorySlug}${a._id.citySlug}`.localeCompare(`${b._id.categorySlug}${b._id.citySlug}`));
  for (const row of ranked) {
    const { categorySlug, citySlug } = row._id;
    const categoryName = categoryNames.get(categorySlug);
    const cityName = cityNames.get(citySlug);
    if (!categoryName || !cityName) continue;
    if (options.excludeCategory && categorySlug === options.excludeCategory) continue;
    if (options.excludePage && options.excludePage.categorySlug === categorySlug && options.excludePage.citySlug === citySlug) continue;
    if (seenCity.has(citySlug)) continue;
    seenCity.add(citySlug);
    out.push({ categorySlug, citySlug, categoryName, cityName, n: row.n });
    if (out.length >= (options.max ?? 6)) break;
  }
  return out;
}
