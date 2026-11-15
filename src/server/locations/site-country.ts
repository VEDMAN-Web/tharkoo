import { connectDb } from "@/lib/db";
import { loadLocations } from "@/server/locations/service";
import { countryOptionsFrom, placesOfCountry, type CountryOption, type ScopedPlace } from "@/server/locations/country-scope";

/** Every enabled country with its own states and cities. Static (no cookie read), so the pages stay cacheable. */
export interface CountryPlaces extends CountryOption {
  states: ScopedPlace[];
  cities: ScopedPlace[];
}

export async function countryPlaces(): Promise<CountryPlaces[]> {
  await connectDb();
  const rows = await loadLocations();
  return countryOptionsFrom(rows).map((option) => ({ ...option, ...placesOfCountry(rows, option.slug) }));
}

/** The enabled countries only, for the header list. */
export async function countryChoices(): Promise<CountryOption[]> {
  await connectDb();
  return countryOptionsFrom(await loadLocations());
}
