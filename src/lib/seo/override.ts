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
