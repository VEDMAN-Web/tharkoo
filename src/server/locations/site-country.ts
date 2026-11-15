import { connectDb } from "@/lib/db";
import { loadLocations } from "@/server/locations/service";
import { countryOptionsFrom, placesOfCountry, type CountryOption, type ScopedPlace } from "@/server/locations/country-scope";
import { loadCountryDirectory } from "@/server/locations/countries";

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

/** An enabled country with its live ad count (the header country menu shows flag and name only). */
export interface CountryChoice extends CountryOption {
  ads: number;
}

/** The enabled countries in admin order, each with its live ad count. */
export async function countryChoices(): Promise<CountryChoice[]> {
  await connectDb();
  const [rows, directory] = await Promise.all([loadLocations(), loadCountryDirectory()]);
  const counts = new Map(directory.map((country) => [country.slug, country.count]));
  return countryOptionsFrom(rows).map((option) => ({ ...option, ads: counts.get(option.slug) ?? 0 }));
}
