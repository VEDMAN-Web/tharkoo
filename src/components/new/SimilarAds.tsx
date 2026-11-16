import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import type { UrlPaths } from "@/lib/urls";
import { HomeAdCard, type HomeAdLabels } from "./HomeAdCard";
import { homeAdCardData } from "./home-ad-data";

export const SIMILAR_ADS_MAX = 8;

export function SimilarAds({
  ads,
  categorySlug,
  categoryName,
  paths,
  title,
  allText,
  allHref,
  listLabel,
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
  fallbackTitle: string;
  labels: HomeAdLabels;
}) {
  const names = new Map([[categorySlug, categoryName]]);
  return (
    <section className="tkn-similar" aria-labelledby="tkn-similar" data-tk="similar-ads">
      <div className="tkn-similar-head">
        <h2 id="tkn-similar">{title}</h2>
        <Link href={allHref} className="tkn-similar-all">{allText}</Link>
      </div>
      <ul className="tkn-similar-grid" aria-label={listLabel}>
        {ads.slice(0, SIMILAR_ADS_MAX).map((ad) => (
          <li key={ad.slug}>
            <HomeAdCard ad={homeAdCardData(ad, names, paths, fallbackTitle)} labels={labels} />
          </li>
        ))}
      </ul>
    </section>
  );
}
