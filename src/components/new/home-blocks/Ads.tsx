import type { ListingDoc } from "@/lib/models";
import { prettyPlace } from "@/lib/format";
import { applyPrefixes, postAdPath, type UrlPaths } from "@/lib/urls";
import type { CountryPlaces } from "@/server/locations/site-country";
import { HomeAdCard, type HomeAdLabels } from "../HomeAdCard";
import { HomeAdsSection } from "../HomeAdsSection";
import { NewAdsGate } from "../NewAdsGate";
import { commonCity } from "../home-copy";
import { homeAdCardData } from "../home-ad-data";
import type { Cat } from "./types";

const HOME_ADS_SHOWN = 8;

export function HomeAds({
  eyebrow,
  titleTemplate,
  defaultPlace,
  listLabel,
  moreText,
  fallbackTitle,
  labels,
  ads,
  categories,
  countries,
  paths,
}: {
  eyebrow: string;
  titleTemplate: string;
  defaultPlace: string;
  listLabel: string;
  moreText: string;
  fallbackTitle: string;
  labels: HomeAdLabels;
  ads: ListingDoc[];
  categories: Cat[];
  countries: CountryPlaces[];
  paths: UrlPaths;
}) {
  const categoryNames = new Map(categories.map((cat) => [cat.slug || "", cat.name || ""]));
  const shown = ads.slice(0, HOME_ADS_SHOWN);
  const city = commonCity(shown);
  const title = titleTemplate.split("{city}").join(city ? prettyPlace(city) : defaultPlace);
  return (
    <NewAdsGate enabledSlugs={countries.map((country) => country.slug)} postHref={postAdPath(paths)}>
      {shown.length ? (
        <HomeAdsSection id="home-fresh" eyebrow={eyebrow} title={title} listLabel={listLabel} moreHref={applyPrefixes("/search/", paths)} moreText={moreText}>
          {shown.map((ad, position) => (
            <li key={ad.slug}>
              <HomeAdCard ad={homeAdCardData(ad, categoryNames, paths, fallbackTitle)} labels={labels} order={position} />
            </li>
          ))}
        </HomeAdsSection>
      ) : null}
    </NewAdsGate>
  );
}
