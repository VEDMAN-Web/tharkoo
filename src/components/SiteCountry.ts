"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COUNTRY_SLUG, SITE_COUNTRY_COOKIE } from "@/server/locations/country-scope";

/** H7.4c: sent after the country cookie is set, so every picker on the page reads the new country. */
export const SITE_COUNTRY_EVENT = "tk-country";

/** The chosen country slug from the cookie, or undefined when none is set. Browser only. */
export function readCountryCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SITE_COUNTRY_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * H7.4d: the slug of the country on show (cookie, else India). Same rule as the header pill, for pickers that only need
 * the slug. The page is cacheable, so the cookie is read in the browser after load.
 */
export function useSiteCountrySlug(): string {
  const [slug, setSlug] = useState<string>(DEFAULT_COUNTRY_SLUG);
  useEffect(() => {
    const sync = () => setSlug(readCountryCookie() || DEFAULT_COUNTRY_SLUG);
    sync();
    window.addEventListener(SITE_COUNTRY_EVENT, sync);
    return () => window.removeEventListener(SITE_COUNTRY_EVENT, sync);
  }, []);
  return slug;
}

/**
 * The country on show for this visitor, read from the cookie after the page loads. Before that (and on the server) it is
 * India, or the first country when India is not enabled. Pass the enabled countries, in admin order.
 */
export function useSiteCountry<T extends { slug: string }>(options: readonly T[]): T | undefined {
  const [slug, setSlug] = useState<string | undefined>(undefined);
  useEffect(() => {
    const sync = () => setSlug(readCountryCookie());
    sync();
    window.addEventListener(SITE_COUNTRY_EVENT, sync);
    return () => window.removeEventListener(SITE_COUNTRY_EVENT, sync);
  }, []);
  return options.find((option) => option.slug === slug) ?? options.find((option) => option.slug === DEFAULT_COUNTRY_SLUG) ?? options[0];
}
