import { listingHeading } from "@/lib/layout/listing";
import type { CopyField, CopySource } from "@/server/content/listing-copy";

/** H8.44: words and small pure helpers of the Listing tab. */

export type HeaderProps = { h1Template: string; introTemplate: string; showCount: boolean; showUpdated: boolean };

export const H1_MAX = 200;
export const INTRO_MAX = 600;
export const HEADER_VARIABLES = ["{h1}", "{category}", "{city}", "{district}", "{state}", "{count}", "{year}", "{site}"] as const;

export const SOURCE_WORDS: Record<CopySource, string> = {
  content: "Content studio (a Listing intro for this address)",
  "url-override": "SEO, Addresses (set for this exact address)",
  "site-landing": "The older landing text saved with the site",
  "listing-header": "The heading and intro template on this tab",
  "seo-template": "SEO templates",
  code: "Built in, as the site writes it by itself",
};

export const FIELD_WORDS: Record<CopyField, string> = {
  h1: "Heading",
  intro: "Intro",
  faqs: "Questions and answers",
  title: "Browser title",
  description: "Search description",
};

export const FIELD_ORDER: readonly CopyField[] = ["h1", "intro", "faqs", "title", "description"];

/** What a template turns into for a sample category and city, so the writer sees the result before saving. */
export function previewHeader(template: string, sample: { category: string; city: string }): string {
  const h1 = `${sample.category} in ${sample.city}`;
  return listingHeading(template, h1, { h1, category: sample.category, city: sample.city, district: "", state: "", count: 24, year: new Date().getFullYear(), site: "Tharkoo" });
}

export function sameHeader(a: HeaderProps, b: HeaderProps): boolean {
  return a.h1Template === b.h1Template && a.introTemplate === b.introTemplate && a.showCount === b.showCount && a.showUpdated === b.showUpdated;
}

/** A category scope or the default. */
export function scopeOf(category: string): string {
  return category ? `category:${category}` : "default";
}
