import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { safePhoto } from "@/lib/media";
import { adHref, applyPrefixes, categoryPath, placePath, type UrlPaths } from "@/lib/urls";
import type { HomeAdCardData } from "./HomeAdCard";

const HOME_AD_PHOTOS_MAX = 6;

export function homeAdCardData(ad: ListingDoc, categoryNames: Map<string, string>, paths: UrlPaths, fallbackTitle: string): HomeAdCardData {
  const photos = (ad.photos || [])
    .map((src) => safePhoto(src))
    .filter((src): src is string => Boolean(src))
    .slice(0, HOME_AD_PHOTOS_MAX);
  const categorySlug = ad.categorySlug || "";
  const categoryHref = applyPrefixes(categoryPath(categorySlug), paths);
  return {
    slug: ad.slug || "",
    title: displayTitle(ad.title) || fallbackTitle,
    photos,
    videoUrl: ad.videoUrl || null,
    videoPoster: ad.videoPoster || null,
    description: (ad.description || "").replace(/\s+/g, " ").trim(),
    age: typeof ad.age === "number" && ad.age > 0 ? ad.age : null,
    categoryName: categoryNames.get(categorySlug) || prettyPlace(ad.categorySlug),
    categoryHref,
    city: prettyPlace(ad.citySlug),
    cityHref: ad.citySlug ? applyPrefixes(placePath(categorySlug, ad.citySlug), paths) : categoryHref,
    href: adHref(paths, ad),
    sample: ad.sample === true,
  };
}
