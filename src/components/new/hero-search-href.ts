import { categoryPath, joinPath, placePath, searchPath, citiesPath, type UrlPaths } from "@/lib/urls";

/**
 * H7.4c: where the hero search goes. Clean SEO addresses only: /category/, /category/city/ or the state hub
 * (/category/state/). Without a category a city goes to its city page; a state alone goes to the cities page.
 */
export function heroSearchHref(paths: UrlPaths, pick: { category?: string; state?: string; city?: string }): string {
  const { category, state, city } = pick;
  if (category && city) return placePath(category, city);
  if (category && state) return placePath(category, state);
  if (category) return categoryPath(category);
  if (city) return joinPath(citiesPath(paths), city);
  if (state) return citiesPath(paths);
  return searchPath(paths);
}
