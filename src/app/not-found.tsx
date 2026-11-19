import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotFoundBeacon } from "@/app/admin/urls/NotFoundBeacon";
import { NotFoundView, type NotFoundAds } from "@/components/new/NotFoundView";
import { commonCity } from "@/components/new/home-copy";
import { listingRowData, rowLabels } from "@/components/new/listing-row-data";
import { prettyPlace } from "@/lib/format";
import { getCategories, getFeed } from "@/lib/queries";
import { searchPath } from "@/lib/urls";
import { makeT, pickTexts } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { getPaths } from "@/server/urls/service";
import { defaultNewDesign, newDesignOn } from "@/server/site-links/new-design";

const NOT_FOUND_TITLE = "Page not found | Tharkoo";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
  description: "That page is not on Tharkoo. Go back to the home page and choose a category.",
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
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    age: t("home.ads.age"),
    row: rowLabels(t),
  },
    cards: shown.map((ad) => listingRowData(ad, categoryNames, paths, t("card.fallbackTitle"))),
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
        <title>{NOT_FOUND_TITLE}</title>
        <NotFoundBeacon />
        <NotFoundView categories={categories} ads={ads} />
      </>
    );
  }
  return (
    <>
      <title>{NOT_FOUND_TITLE}</title>
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
