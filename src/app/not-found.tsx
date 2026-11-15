import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotFoundBeacon } from "@/app/admin/urls/NotFoundBeacon";
import { NotFoundView, type NotFoundAds } from "@/components/new/NotFoundView";
import { commonCity, tierKeyOf } from "@/components/new/home-copy";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingPhotos, safePhoto } from "@/lib/media";
import { getCategories, getFeed } from "@/lib/queries";
import { adPath, searchPath } from "@/lib/urls";
import { makeT, pickTexts } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { getPaths } from "@/server/urls/service";
import { defaultNewDesign, newDesignOn } from "@/server/site-links/new-design";

export const metadata: Metadata = {
  title: "Page not found | Tharkoo",
  description: "That page is not on Tharkoo. Go back to the home page and choose a category.",
  robots: { index: false, follow: false },
};

async function latestAds(categoryNames: Map<string, string>): Promise<NotFoundAds | null> {
  const [feed, paths, overrides] = await Promise.all([getFeed({}, 1).catch(() => null), getPaths(), textOverrides()]);
  const shown = feed?.items.slice(0, 4) || [];
  if (!shown.length) return null;
  const t = makeT(pickTexts(overrides, "card.", "home."));
  const city = commonCity(shown);
  const cityName = city ? prettyPlace(city) : t("home.ads.defaultPlace");
  return {
    eyebrow: t("home.ads.eyebrow"),
    title: t("home.ads.title", { city: cityName }),
    seeAll: t("home.ads.all"),
    seeAllHref: searchPath(paths),
    labels: {
      view: t("home.ads.view"),
      online: t("home.ads.online"),
      away: t("home.ads.away"),
      watermark: t("home.ads.watermark"),
      views: t("home.ads.views"),
    },
    cards: shown.map((ad) => {
      const place = prettyPlace(ad.citySlug);
      const tier = tierKeyOf(ad.variant);
      return {
        slug: ad.slug || "",
        title: displayTitle(ad.title) || t("card.fallbackTitle"),
        price: ad.price,
        photo: safePhoto(listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || [])[0]),
        categoryName: categoryNames.get(ad.categorySlug || "") || prettyPlace(ad.categorySlug),
        place: ad.place && ad.place !== place ? `${place} / ${ad.place}` : place,
        href: adPath(paths, ad.slug || ""),
        badge: tier ? t(tier) : "",
      };
    }),
  };
}

export default async function NotFound() {
  const newDesign = await newDesignOn().catch(() => defaultNewDesign());
  if (newDesign) {
    const all = await getCategories()
      .then((list) => list.filter((category) => category.slug && category.name).map((category) => ({ slug: category.slug || "", name: category.name || "" })))
      .catch(() => []);
    const categories = all.slice(0, 5);
    const categoryNames = new Map(all.map((category) => [category.slug, category.name]));
    const ads = await latestAds(categoryNames).catch(() => null);
    return (
      <>
        <NotFoundBeacon />
        <NotFoundView categories={categories} ads={ads} />
      </>
    );
  }
  return (
    <>
      <NotFoundBeacon />
      <EmptyState
        heading="h1"
        title="Page not found"
        body="That page is not on Tharkoo. Head home and pick a category."
        action={{ href: "/", label: "Back to home" }}
      />
    </>
  );
}
