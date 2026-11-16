import type { ListingDoc } from "@/lib/models";
import type { UrlPaths } from "@/lib/urls";
import { HomeAdCard, type HomeAdLabels } from "./HomeAdCard";
import { homeAdCardData } from "./home-ad-data";
import { SimilarRow } from "./SimilarRow";

export const SIMILAR_ADS_MAX = 12;

export function SimilarAds({
  ads,
  categorySlug,
  categoryName,
  paths,
  title,
  allText,
  allHref,
  listLabel,
  prevLabel,
  nextLabel,
  fallbackTitle,
  labels,
}: {
  ads: ListingDoc[];
  categorySlug: string;
  categoryName: string;
  paths: UrlPaths;
  title: string;
  allText: string;
  allHref: string;
  listLabel: string;
  prevLabel: string;
  nextLabel: string;
  fallbackTitle: string;
  labels: HomeAdLabels;
}) {
  const names = new Map([[categorySlug, categoryName]]);
  return (
    <SimilarRow title={title} allText={allText} allHref={allHref} listLabel={listLabel} prevLabel={prevLabel} nextLabel={nextLabel}>
      {ads.slice(0, SIMILAR_ADS_MAX).map((ad) => (
        <li key={ad.slug}>
          <HomeAdCard ad={homeAdCardData(ad, names, paths, fallbackTitle)} labels={labels} />
        </li>
      ))}
    </SimilarRow>
  );
}
