"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useSiteCountrySlug } from "@/components/SiteCountry";
import { isoCountryBySlug } from "@/lib/countries";
import { DEFAULT_COUNTRY_SLUG } from "@/server/locations/country-scope";

/**
 * H7.10 / P1: the "Latest ads" block. A visitor who chose a country the admin has not enabled sees an empty state here
 * instead of the ads: a pastel icon, "No ads in {Country} yet", a line inviting the first post and one "Post your ad"
 * button. The choice is in the browser cookie, so it is read after the page loads (the page stays cacheable).
 */
export function NewAdsGate({ enabledSlugs, postHref, children }: { enabledSlugs: string[]; postHref: string; children: ReactNode }) {
  const slug = useSiteCountrySlug();
  const chosen = isoCountryBySlug(slug);
  const hasAds = slug === DEFAULT_COUNTRY_SLUG || enabledSlugs.includes(slug) || !chosen;
  if (hasAds || !chosen) return <>{children}</>;
  return (
    <section className="tkh-page tkh-section tkh-empty" aria-labelledby="home-empty">
      <div className="tkh-empty-card">
        <span className="tkh-empty-icon" aria-hidden="true">
          <MapPin size={28} strokeWidth={2} />
        </span>
        <h2 id="home-empty" className="tkh-empty-title">No ads in {chosen.name} yet</h2>
        <p className="tkh-empty-text">Be the first to post here.</p>
        <Link className="tkn-btn tkn-btn-primary" href={postHref} prefetch={false}>
          Post your ad
        </Link>
      </div>
    </section>
  );
}
