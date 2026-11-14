"use server";

import { footerCountries, loadCountryDirectory, type DirectoryCountry } from "@/server/locations/countries";

/** Public data for the footer "Countries" block: only places with at least one active ad, at most 12 countries. */
export async function getFooterCountries(): Promise<DirectoryCountry[]> {
  try {
    return footerCountries(await loadCountryDirectory());
  } catch (error) {
    console.error("footer countries failed", error instanceof Error ? error.message : error);
    return [];
  }
}
