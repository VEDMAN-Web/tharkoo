import type { Metadata } from "next";
import { getSeoSettings } from "@/app/admin/seo/settings/store";
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from "@/app/admin/seo/settings/rules";
import { organizationFromSettings } from "@/lib/seo/schema";
import { urlFaqs, urlIntro } from "@/lib/seo/override";
import { cleanPath } from "@/lib/urls";

export interface HubCopy {
  intro: string;
  faqs: { q: string; a: string }[];
}

/** Intro and questions for a hub page: the per-URL override when one is saved, otherwise the built-in copy. */
export async function hubCopy(path: string, fallback: HubCopy): Promise<HubCopy> {
  const clean = cleanPath(path);
  const [intro, faqs] = await Promise.all([urlIntro(clean, fallback.intro), urlFaqs(clean)]);
  return { intro, faqs: faqs.length ? faqs : fallback.faqs };
}

async function settingsOrDefault(): Promise<SeoSettings> {
  return getSeoSettings().catch(() => DEFAULT_SEO_SETTINGS);
}

/** Organization JSON-LD node using the name, logo, contact and links from /admin/seo/settings, with built-in values when empty. */
export async function siteOrganizationNode(defaultName: string, base: { logo?: string; sameAs?: string[] }) {
  const settings = await settingsOrDefault();
  return organizationFromSettings(defaultName, base, settings.organization);
}

/** The default social image set in the SEO settings, or an empty string. */
export async function defaultOgImage(): Promise<string> {
  return (await settingsOrDefault()).defaultOgImage.trim();
}
