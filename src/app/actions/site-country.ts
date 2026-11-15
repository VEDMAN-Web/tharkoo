"use server";

import { cookies } from "next/headers";
import { loadLocations } from "@/server/locations/service";
import { countryOptionsFrom, SITE_COUNTRY_COOKIE } from "@/server/locations/country-scope";

const SLUG = /^[a-z0-9-]{1,80}$/;
const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** H7.4c: sets the site country cookie. Only an enabled country slug is accepted. */
export async function setSiteCountry(slug: string): Promise<{ ok: true; slug: string } | { ok: false; message: string }> {
  if (!SLUG.test(slug)) return { ok: false, message: "Choose a country from the list." };
  const options = countryOptionsFrom(await loadLocations());
  if (!options.some((option) => option.slug === slug)) return { ok: false, message: "That country is not available." };
  (await cookies()).set(SITE_COUNTRY_COOKIE, slug, { path: "/", maxAge: YEAR_SECONDS, sameSite: "lax", httpOnly: false });
  return { ok: true, slug };
}
