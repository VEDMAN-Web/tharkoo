/**
 * H7.4c: the site country. The header shows the chosen country, and the place lists (states and cities) show only that
 * country's places. Pure: no database, so the rules are unit tested. The cookie is read by the pages (see site-country.ts).
 */
import type { LocationRow } from "@/server/locations/service";
import { flagFromCode } from "@/server/locations/flag";

/** The cookie that holds the chosen country slug. */
export const SITE_COUNTRY_COOKIE = "tk_country";
/** The country used when no cookie is set (or the cookie names a country that is not enabled). */
export const DEFAULT_COUNTRY_SLUG = "india";

export interface CountryOption {
  slug: string;
  name: string;
  flag: string;
}

export interface ScopedPlace {
  slug: string;
  name: string;
  /** The state slug of a city ("" for a state). */
  stateSlug: string;
}

type RowWithCode = LocationRow & { countryCode?: string };

function byOrder(a: LocationRow, b: LocationRow) {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
}

/** The enabled countries in admin order: the list the header menu shows. */
export function countryOptionsFrom(rows: RowWithCode[]): CountryOption[] {
  return rows
    .filter((row) => row.type === "country" && row.enabled !== false)
    .sort(byOrder)
    .map((row) => ({ slug: row.slug, name: row.name, flag: flagFromCode(row.countryCode) }));
}

/** The country on show: the cookie's country when it is enabled, else India, else the first country. */
export function pickSiteCountry(options: CountryOption[], cookieValue: string | undefined): CountryOption | undefined {
  return options.find((option) => option.slug === cookieValue) ?? options.find((option) => option.slug === DEFAULT_COUNTRY_SLUG) ?? options[0];
}

/** Walks up from a row and returns the country it belongs to, or "" when it has none. */
function countryOf(row: LocationRow, index: Map<string, LocationRow>): string {
  const seen = new Set<string>();
  let current: LocationRow | undefined = row;
  while (current && !seen.has(String(current._id))) {
    if (current.type === "country") return current.slug;
    seen.add(String(current._id));
    current = current.parentId ? index.get(String(current.parentId)) : undefined;
  }
  return "";
}

/**
 * The states and cities of one country, enabled only. A city is kept only when its state is in the same country, so a
 * city list never shows another country's places. Sorted by name.
 */
export function placesOfCountry(rows: LocationRow[], countrySlug: string): { states: ScopedPlace[]; cities: ScopedPlace[] } {
  const live = rows.filter((row) => row.enabled !== false);
  const index = new Map(live.map((row) => [String(row._id), row]));
  const inCountry = (row: LocationRow) => countryOf(row, index) === countrySlug;
  const states = live
    .filter((row) => row.type === "state" && inCountry(row))
    .map((row) => ({ slug: row.slug, name: row.name, stateSlug: "" }));
  const stateSlugOf = (row: LocationRow) => {
    const parent = row.parentId ? index.get(String(row.parentId)) : undefined;
    return parent?.type === "state" ? parent.slug : "";
  };
  const cities = live
    .filter((row) => row.type === "city" && inCountry(row))
    .map((row) => ({ slug: row.slug, name: row.name, stateSlug: stateSlugOf(row) }));
  const byName = (a: ScopedPlace, b: ScopedPlace) => a.name.localeCompare(b.name);
  return { states: states.sort(byName), cities: cities.sort(byName) };
}
