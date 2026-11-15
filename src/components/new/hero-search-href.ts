import { categoryPath, joinPath, placePath, searchPath, citiesPath, type UrlPaths } from "@/lib/urls";

/**
 * H7.4c: where the hero search goes. Clean SEO addresses only: /category/, /category/city/ or the state hub
 * (/category/state/). Without a category a city goes to its city page (H7.32: it shows the ads). A state alone goes
 * to the search page filtered to that state. Nothing picked goes to search, which lists every live ad.
 */
export function heroSearchHref(paths: UrlPaths, pick: { category?: string; state?: string; city?: string }): string {
  const { category, state, city } = pick;
  if (category && city) return placePath(category, city);
  if (category && state) return placePath(category, state);
  if (category) return categoryPath(category);
  if (city) return joinPath(citiesPath(paths), city);
  if (state) return `${searchPath(paths)}?state=${encodeURIComponent(state)}`;
  return searchPath(paths);
}
