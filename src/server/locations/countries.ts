import { Types } from "mongoose";
import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { flagFromCode } from "@/server/locations/flag";
import { loadLocations, type LocationRow } from "@/server/locations/service";

export { flagFromCode };
export const FOOTER_COUNTRY_LIMIT = 12;

export interface DirectoryCity {
  slug: string;
  name: string;
  count: number;
}

export interface DirectoryCountry {
  slug: string;
  name: string;
  flag: string;
  count: number;
  cities: DirectoryCity[];
}

function byOrder(a: LocationRow, b: LocationRow) {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
}

/**
 * Builds the country > city tree. `counts` maps a city id to its active ads.
 * Hidden locations (and anything under a hidden parent) are left out.
 * With `onlyWithAds` only countries and cities with at least one active ad stay.
 */
export function buildCountryDirectory(
  rows: (LocationRow & { countryCode?: string })[],
  counts: Map<string, number>,
  options: { onlyWithAds?: boolean } = {},
): DirectoryCountry[] {
  const live = rows.filter((row) => row.enabled !== false);
  const index = new Map(live.map((row) => [String(row._id), row]));
  const countryOf = (row: LocationRow) => {
    const seen = new Set<string>();
    let current: LocationRow | undefined = row;
    while (current && !seen.has(String(current._id))) {
      if (current.type === "country") return current;
      seen.add(String(current._id));
      current = current.parentId ? index.get(String(current.parentId)) : undefined;
    }
    return undefined;
  };
  const tree = new Map<string, DirectoryCountry>();
  for (const country of live.filter((row) => row.type === "country").sort(byOrder)) {
    const flag = flagFromCode((country as { countryCode?: string }).countryCode);
    tree.set(String(country._id), { slug: country.slug, name: country.name, flag, count: 0, cities: [] });
  }
  for (const city of live.filter((row) => row.type === "city").sort(byOrder)) {
    const country = countryOf(city);
    const entry = country ? tree.get(String(country._id)) : undefined;
    if (!entry) continue;
    const count = counts.get(String(city._id)) ?? 0;
    entry.count += count;
    entry.cities.push({ slug: city.slug, name: city.name, count });
  }
  const all = [...tree.values()];
  if (!options.onlyWithAds) return all;
  return all
    .filter((country) => country.count > 0)
    .map((country) => ({ ...country, cities: country.cities.filter((city) => city.count > 0).sort((a, b) => b.count - a.count) }));
}

export function footerCountries(all: DirectoryCountry[]): DirectoryCountry[] {
  return all
    .filter((country) => country.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, FOOTER_COUNTRY_LIMIT)
    .map((country) => ({
      ...country,
      cities: country.cities.filter((city) => city.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }));
}

async function activeCityCounts(): Promise<Map<string, number>> {
  await connectDb();
  const now = new Date();
  const groups = await Listing.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        status: "active",
        cityId: { $exists: true, $ne: null },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
      },
    },
    { $group: { _id: "$cityId", n: { $sum: 1 } } },
  ]);
  return new Map(groups.map((group) => [String(group._id), group.n]));
}

/** Every enabled country with its cities and live ad counts. Cached briefly. */
export async function loadCountryDirectory(): Promise<DirectoryCountry[]> {
  return cached(
    "locations:country-directory",
    60_000,
    async () => buildCountryDirectory(await loadLocations(), await activeCityCounts()),
    ["locations", "listings"],
  );
}
