import { notFound, permanentRedirect } from "next/navigation";
import { withPagination } from "@/lib/seo/pagination";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { ListingFrame } from "@/components/new/ListingFrame";
import { bandChoice, hasOwnBand, heroBandFrom } from "@/components/new/band-image";
import { introCategory, listingFrameProps, listingLabels, placeSelects } from "@/components/new/listing-frame-props";
import { loadCardWidth } from "@/server/listings/card-width";
import { FallbackAds } from "@/components/FallbackAds";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { readShellConfig } from "@/server/site-links/shell-config";
import { getPaths } from "@/server/urls/service";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { getCategories, getCategory, getCities, getCityBySlug, getDistricts, getHomepageContent, getSite, getStates } from "@/lib/queries";
import { fallbackLanding } from "@/lib/seo/landing";
import { subcategoryCopy } from "@/server/seo/templates";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { placePath, postAdPath } from "@/lib/urls";
import { findSubcategory, isSubcategoryIndexable, subcategoryChips, subcategoryFeed } from "@/server/categories/public";
import { Location } from "@/server/models";
import { connectDb } from "@/lib/db";

export type SubHubParams = { category: string; location: string; district: string };

async function resolve({ category, location, district }: SubHubParams) {
  const cat = await getCategory(category);
  if (!cat?._id) return null;
  const found = await findSubcategory(String(cat._id), district);
  if (!found) return null;
  const city = await getCityBySlug(location);
  if (!city) return null;
  await connectDb();
  const row = await Location.findOne({ type: "city", slug: city.slug || location }).select("_id").lean<{ _id: unknown }>();
  if (!row) return null;
  return { cat, city, cityId: String(row._id), ...found };
}

function copyFor(input: { catName: string; cityName: string; subName: string; subIntro: string; count: number; site?: string; indexable: boolean }) {
  const base = fallbackLanding({ category: input.subName, city: input.cityName, count: input.count, site: input.site, indexable: input.indexable });
  return { ...base, h1: `${input.subName} in ${input.cityName}`, intro: input.subIntro || base.intro };
}

type CopyInput = Parameters<typeof copyFor>[0];

/** Built-in copy, with the "subcategory" SEO template (if one is saved) winning field by field. */
async function templatedCopy(categorySlug: string, input: CopyInput) {
  const base = copyFor(input);
  const merged = await subcategoryCopy(categorySlug, { subcategory: input.subName, city: input.cityName, count: input.count, site: input.site || "" }, base);
  return { ...base, ...merged };
}

/** True when the last address part is a sub-category of this category. Used by the district route before it gives up. */
export async function isSubHub(params: SubHubParams) {
  return (await resolve(params)) !== null;
}

export async function subHubMetadata(params: SubHubParams, page: number): Promise<Metadata> {
  const hub = await resolve(params);
  if (!hub) return {};
  const [site, feed] = await Promise.all([getSite(), subcategoryFeed({ categoryId: String(hub.cat._id), cityId: hub.cityId, subcategoryId: hub.sub.id, page: 1 })]);
  const copy = await templatedCopy(hub.cat.slug || params.category, {
    catName: hub.cat.name || params.category,
    cityName: hub.city.name || params.location,
    subName: hub.sub.name,
    subIntro: hub.sub.seoIntro,
    count: feed.total,
    site: site.name,
    indexable: isSubcategoryIndexable(feed.total),
  });
  const path = placePath(hub.cat.slug || params.category, hub.city.slug || params.location, hub.sub.slug);
  const meta = await withUrlSeo(path, {
    title: copy.title,
    description: copy.description,
    path: page > 1 ? `${path}?page=${page}` : path,
    index: isSubcategoryIndexable(feed.total, page),
    follow: true,
  });
  return withPagination(meta, path, page, feed.pages);
}

export async function SubHub({ params, page }: { params: SubHubParams; page: number }) {
  const hub = await resolve(params);
  if (!hub) notFound();
  const catSlug = hub.cat.slug || params.category;
  const citySlug = hub.city.slug || params.location;
  if (hub.redirectTo || catSlug !== params.category || citySlug !== params.location) {
    permanentRedirect(placePath(catSlug, citySlug, hub.sub.slug));
  }
  const canonicalPath = placePath(catSlug, citySlug, hub.sub.slug);
  const [site, feed, siblings, texts, heading, shell, hero, paths, categories, states, cities, districts, cardWidth] = await Promise.all([
    getSite(),
    subcategoryFeed({ categoryId: String(hub.cat._id), cityId: hub.cityId, subcategoryId: hub.sub.id, page }),
    subcategoryChips(catSlug, citySlug),
    textOverrides(),
    urlHeading(canonicalPath, ""),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    getPaths(),
    getCategories(),
    getStates(),
    getCities(),
    getDistricts(hub.city.slug || params.location),
    loadCardWidth(),
  ]);
  if (page > feed.pages) notFound();
  const t = makeT(texts);
  const copy = await templatedCopy(catSlug, {
    catName: hub.cat.name || catSlug,
    cityName: hub.city.name || citySlug,
    subName: hub.sub.name,
    subIntro: hub.sub.seoIntro,
    count: feed.total,
    site: site.name,
    indexable: isSubcategoryIndexable(feed.total),
  });
  const vars = { category: hub.cat.name, city: hub.city.name, sub: hub.sub.name, site: site.name, count: feed.total, year: new Date().getFullYear() };
  const layout = await resolveListingLayout({ path: canonicalPath, category: catSlug, vars });
  const crumbs = [
    { name: t("listing.crumb.home"), path: "/" },
    { name: hub.cat.name!, path: `/${catSlug}/` },
    { name: `${hub.city.name} ${hub.cat.name}`, path: placePath(catSlug, citySlug) },
    { name: `${hub.sub.name} ${hub.city.name}`, path: canonicalPath },
  ];
  const h1 = heading || copy.h1;
  const own = showFallback(feed);
  const fallback = own
    ? await loadFallbackSections({
        scope: { categorySlug: hub.cat.slug || catSlug, categoryName: hub.cat.name || undefined, stateSlug: hub.city.stateSlug || undefined, placeName: hub.city.name },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
        t,
      })
    : [];
  const lead =
    feed.total === 0
      ? { text: t("listing.empty.leadPlace", { place: hub.city.name || "" }), button: t("listing.empty.buttonPlace", { place: hub.city.name || "" }), href: postAdPath(paths) }
      : undefined;
  const labels = listingLabels(t);
  const homeContent = await getHomepageContent();
  const frame = listingFrameProps({
    crumbs,
    h1,
    intro: t("listing.band.introPlace", { category: introCategory(hub.sub.name), place: hub.city.name }),
    photo: bandChoice(shell, hero, { city: citySlug, category: catSlug }),
    categorySlug: catSlug,
    citySlug,
    searchAction: placePath(catSlug, citySlug),
    searchPlaceholder: `Search ${hub.cat.name} in ${hub.city.name}`,
    chips: null,
    fields: undefined,
    picks: {},
    toggles: { verified: false, photos: false, video: false, online: false },
    panelPath: canonicalPath,
    labels,
    placesOnly: true,
    showBand: homeContent.showListingBand || hasOwnBand(shell, { city: citySlug, category: catSlug }),
    template: {
      state: {
        category: { slug: catSlug, name: hub.cat.name || catSlug },
        city: { slug: citySlug, name: hub.city.name || citySlug },
        toggles: { verified: false, photos: false, video: false, online: false },
        picks: {},
      },
      crumbs,
      h1,
      total: feed.total,
      nearby: own,
      placeName: hub.city.name || undefined,
      pagePath: canonicalPath,
      extraChips: [{ key: "sub", label: `${hub.sub.name}`, removeLabel: `Remove ${hub.sub.name}`, href: placePath(catSlug, citySlug) }],
      t,
    },
    places: placeSelects({
      categorySlug: catSlug,
      categories,
      states,
      cities,
      districts,
      stateSlug: hub.city.stateSlug || undefined,
      citySlug,
      labels,
    }),
  });
  return (
    <div data-card-width={cardWidth}>
    <ListingFrame
      header={frame.header}
      bandStyle={frame.bandStyle}
      labels={labels}
      head={frame.head}
      chips={frame.chips}
      searchForm={frame.searchForm}
      filters={frame.filters}
      activeCount={frame.activeCount}
    >
    <ListingPageView
      layout={layout}
      texts={texts}
      faqs={copy.faqs}
      intro={copy.intro}
      crumbs={crumbs}
      path={canonicalPath}
      stars={[]}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={!isSubcategoryIndexable(feed.total, page)}
      siblingLinks={siblings
        .filter((chip) => chip.slug !== hub.sub.slug)
        .slice(0, 5)
        .map((chip) => ({ href: placePath(catSlug, citySlug, chip.slug), label: t("listing.link.in", { name: chip.name, place: hub.city.name }) }))
        .concat([{ href: placePath(catSlug, citySlug), label: t("listing.link.in", { name: hub.cat.name, place: hub.city.name }) }])}
      emptyNearby={[{ href: placePath(catSlug, citySlug), label: hub.city.name! }]}
      hideEmpty={feed.total === 0}
      fallback={own ? <FallbackAds sections={fallback} lead={lead} layout="row" /> : undefined}
    />
    </ListingFrame>
    </div>
  );
}
