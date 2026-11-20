import type { Metadata } from "next";
import { cleanPath } from "@/lib/urls";
import { pageMetadata, type PageMeta } from "@/lib/ui/meta";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { getUrlOverride } from "@/server/urls/service";

/**
 * The override saved for a path. H16.2: an ad moved from /ad/<slug>/ to its own address; an override saved for the old path
 * still applies (the new path wins when both exist). Only the ad page passes `legacyPath`.
 */
async function overrideFor(path: string, legacyPath?: string) {
  return (await getUrlOverride(cleanPath(path))) ?? (legacyPath ? await getUrlOverride(cleanPath(legacyPath)) : null);
}

export async function withUrlSeo(path: string, opts: PageMeta, legacyPath?: string): Promise<Metadata> {
  const over = await overrideFor(path, legacyPath);
  const canonicalOverride = over?.canonical?.trim();
  return withSeoDefaults(pageMetadata({
    ...opts,
    title: over?.title?.trim() || opts.title,
    description: over?.description?.trim() || opts.description,
    index: over?.noindex ? false : opts.index,
    image: over?.ogImage?.trim() || opts.image,
    canonicalUrl: canonicalOverride || opts.canonicalUrl || undefined,
  }));
}

export async function urlHeading(path: string, fallback: string, legacyPath?: string) {
  const over = await overrideFor(path, legacyPath);
  return over?.h1?.trim() || fallback;
}

/** Intro text set for one URL, or the fallback. */
export async function urlIntro(path: string, fallback: string) {
  const over = await getUrlOverride(cleanPath(path));
  return over?.intro?.trim() || fallback;
}

/** Questions and answers set for one URL (at most 8); empty when none. */
export async function urlFaqs(path: string): Promise<{ q: string; a: string }[]> {
  const over = await getUrlOverride(cleanPath(path));
  return (over?.faq ?? []).filter((item) => item.q && item.a).slice(0, 8).map((item) => ({ q: item.q as string, a: item.a as string }));
}
