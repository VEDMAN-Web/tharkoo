"use server";

import { cookies } from "next/headers";
import { loadLocations } from "@/server/locations/service";
import { countryOptionsFrom, SITE_COUNTRY_COOKIE } from "@/server/locations/country-scope";
import { isoCountryBySlug } from "@/lib/countries";

const SLUG = /^[a-z0-9-]{1,80}$/;
const YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * H7.4c / H7.10: sets the site country cookie. An enabled country or any ISO country is accepted: a country the admin has
 * not enabled gets the home page with an empty state (see NewAdsGate).
 */
export async function setSiteCountry(slug: string): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  if (!SLUG.test(slug)) return { ok: false, message: "Choose a country from the list." };
  const options = countryOptionsFrom(await loadLocations());
  const known = options.some((option) => option.slug === slug) || Boolean(isoCountryBySlug(slug));
  if (!known) return { ok: false, message: "That country is not available." };
  (await cookies()).set(SITE_COUNTRY_COOKIE, slug, { path: "/", maxAge: YEAR_SECONDS, sameSite: "lax", httpOnly: false });
  return { ok: true, slug };
}
