import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import type { UrlPaths } from "@/lib/urls";
import { HomeAdCard, type HomeAdLabels } from "./HomeAdCard";
import { homeAdCardData } from "./home-ad-data";

/** H19.2: four similar ads, two by two on a phone and on a computer. */
export const SIMILAR_ADS_MAX = 4;

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
        <div className="tkn-similar-tools">
          <Link href={allHref} className="tkn-similar-all">{allText}</Link>
        </div>
      </div>
      <ul className="tkn-similar-grid" aria-label={listLabel} data-tk="similar-row">
        {ads.slice(0, SIMILAR_ADS_MAX).map((ad) => (
          <li key={ad.slug}>
            <HomeAdCard ad={homeAdCardData(ad, names, paths, fallbackTitle)} labels={labels} />
          </li>
        ))}
      </ul>
    </section>
  );
}
