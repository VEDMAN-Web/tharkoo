import type { ListingDoc } from "@/lib/models";
import { isCityAlias } from "@/lib/seo/district-alias";
import { prettyPlace } from "@/lib/format";
import type { UrlPaths } from "@/lib/urls";
import { formatPrice } from "@/components/search/price";
import type { TextFn } from "@/lib/ui/text";
import type { HomeAdCardData } from "./HomeAdCard";
import { homeAdCardData } from "./home-ad-data";

/** The plan badge shown top left of the photo. Empty for a free ad. */
export type RowTier = "" | "new" | "top" | "supertop" | "featured";

/** What the row card shows on top of the Home card data (H14.1). */
export type ListingRowData = HomeAdCardData & {
  tier: RowTier;
  verified: boolean;
  /** The district or area, when it adds to the city. */
  area: string;
  /** "Rs 12,500" or "" when the ad has no usable price. */
  price: string;
  /** People ads do not show a price (except wellness), as on the ad page. */
  showPrice: boolean;
};

export type RowLabels = {
  tierNew: string;
  tierTop: string;
  tierSuperTop: string;
  tierFeatured: string;
  photoVerified: string;
  views: string;
  viewOne: string;
  clicks: string;
  clickOne: string;
  saveAd: string;
};

const PRICED_PEOPLE = new Set(["wellness"]);
const PEOPLE_CATEGORIES = new Set(["dating", "friendship", "meetups", "personal-ads"]);

export function rowLabels(t: TextFn): RowLabels {
  return {
    tierNew: t("card.tier.new"),
    tierTop: t("card.tier.top"),
    tierSuperTop: t("card.tier.supertop"),
    tierFeatured: t("ad.pill.featured"),
    photoVerified: t("card.photoVerified"),
    views: t("home.ads.views"),
    viewOne: t("home.ads.viewOne"),
    clicks: t("card.clicks"),
    clickOne: t("card.clickOne"),
    saveAd: t("card.saveAd"),
  };
}

export function tierOf(variant?: string): RowTier {
  switch (variant) {
    case "new":
      return "new";
    case "top":
      return "top";
    case "supertop":
    case "flash":
      return "supertop";
    case "star":
    case "highlight":
      return "featured";
    default:
      return "";
  }
}

/** A people ad (an age, or a people category) never plays video on a card and does not show a price. */
function isPeopleAd(ad: ListingDoc) {
  return (typeof ad.age === "number" && ad.age > 0) || PEOPLE_CATEGORIES.has(ad.categorySlug || "");
}

export function listingRowData(ad: ListingDoc, categoryNames: Map<string, string>, paths: UrlPaths, fallbackTitle: string): ListingRowData {
  const base = homeAdCardData(ad, categoryNames, paths, fallbackTitle);
  const people = isPeopleAd(ad);
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && !isCityAlias(city, ad.place) ? ad.place : "";
  return {
    ...base,
    videoUrl: people ? null : base.videoUrl,
    videoPoster: people ? null : base.videoPoster,
    tier: tierOf(ad.variant),
    verified: Boolean(ad.verified),
    area,
    price: formatPrice(ad.price),
    showPrice: !people || PRICED_PEOPLE.has(ad.categorySlug || ""),
  };
}
