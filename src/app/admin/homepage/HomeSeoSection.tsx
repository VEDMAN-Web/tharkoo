"use client";

import { saveHomeSeoForAdmin } from "@/app/admin/content-actions";
import { SeoTitleSection } from "@/components/admin/SeoTitleSection";

/** The home page title and description (H6.10). Saves the fields the public page reads, through the shared section. */
export function HomeSeoSection({ initial, siteLabel }: { initial: { seoTitle: string; seoDescription: string }; siteLabel: string }) {
  return (
    <SeoTitleSection
      headingId="home-seo-heading"
      initial={initial}
      siteLabel={siteLabel}
      save={(input) => saveHomeSeoForAdmin(input)}
    />
  );
}
