import type { Metadata } from "next";
import { cleanPath } from "@/lib/urls";
import { pageMetadata, type PageMeta } from "@/lib/ui/meta";
import { getUrlOverride } from "@/server/urls/service";

export async function withUrlSeo(path: string, opts: PageMeta): Promise<Metadata> {
  const over = await getUrlOverride(cleanPath(path));
  const canonicalOverride = over?.canonical?.trim();
  return pageMetadata({
    ...opts,
    title: over?.title?.trim() || opts.title,
    description: over?.description?.trim() || opts.description,
    index: over?.noindex ? false : opts.index,
    image: over?.ogImage?.trim() || opts.image,
    canonicalUrl: canonicalOverride || undefined,
  });
}

export async function urlHeading(path: string, fallback: string) {
  const over = await getUrlOverride(cleanPath(path));
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
