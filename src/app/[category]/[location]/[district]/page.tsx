import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { ListingFrame } from "@/components/new/ListingFrame";
import { bandChoice, hasOwnBand, heroBandFrom } from "@/components/new/band-image";
import { introCategory, listingFrameProps, listingLabels, placeSelects } from "@/components/new/listing-frame-props";
import { listingFilterQuery } from "@/components/new/listing-filters";
import { narrowFromParams } from "@/components/new/listing-narrow";
import { loadCardWidth } from "@/server/listings/card-width";
import { FallbackAds } from "@/components/FallbackAds";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { readShellConfig } from "@/server/site-links/shell-config";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import {
  getCategories,
  getCategory,
  getCities,
  getCityBySlug,
  getDistricts,
  getFeed,
  getHomepageContent,
  getSeoFor,
  getSite,
  getStarListings,
  getStates,
  pageOutOfRange,
} from "@/lib/queries";
import { prettyPlace } from "@/lib/format";
import { canonical, fillTemplate } from "@/lib/seo";
import { isCityAlias } from "@/lib/seo/district-alias";
import { districtMinimum, getIndexing, isHubOn } from "@/server/seo/indexing";
import { placePath, postAdPath, tagPath } from "@/lib/urls";
import { activeFilterKeys, listingCanonicalSuffix, type ListingParams } from "@/server/search/filter-seo";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { fallbackLanding, visibleHeading } from "@/lib/seo/landing";
import { getPaths, publicTags } from "@/server/urls/service";
import { withPagination } from "@/lib/seo/pagination";
import { SubHub, subHubMetadata } from "./sub-hub";

type Props = {
  params: Promise<{ category: string; location: string; district: string }>;
  searchParams: Promise<ListingParams>;
};

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, location, district } = await params;
  const sp = await searchParams;
  const [cat, city, districtRows, seo, site] = await Promise.all([
    getCategory(category),
    getCityBySlug(location),
    getDistricts(location),
    getSeoFor("district", category, "location"),
    getSite(),
  ]);
  const dist = districtRows.find((row) => row.slug === district);
  // A last address part that is not a district may be a sub-category: /{category}/{city}/{sub}/.
  if (cat && city && !dist) return subHubMetadata({ category, location, district }, Math.max(1, Number(sp.page) || 1));
  if (!cat || !city || !dist || isCityAlias(city.name, dist.name)) return {};
  const distMin = districtMinimum(await getIndexing(), cat, city.slug || location);
  const vars = {
    category: cat.name,
    city: city.name,
    district: dist.name,
    districtPref: ` / ${dist.name}`,
    site: site.name,
  };
  const feedForCopy = await getFeed({ categorySlug: category, citySlug: location, districtSlug: district }, 1);
  const copy = fallbackLanding({
    category: cat.name || category,
    city: city.name || location,
    district: dist.name || district,
    count: feedForCopy.total,
    site: site.name,
  });
  const counted = { ...vars, count: feedForCopy.total };
  const title = fillTemplate(seo?.title || copy.title, counted);
  const rawDescription = fillTemplate(seo?.description || copy.description, counted);
  const description = rawDescription.length <= 160 ? rawDescription : `${rawDescription.slice(0, 157).replace(/\s+\S*$/, "")}`;
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const filtered = activeFilterKeys(sp).length > 0;
  const feed = await getFeed(
    { categorySlug: category, citySlug: location, districtSlug: district, ...narrowFromParams(sp, cat.fields).filter },
    pageNo,
  );
  const path = placePath(cat.slug || category, city.slug || location, dist.slug || district);
  const suffix = listingCanonicalSuffix(sp, pageNo);
  const meta = await withUrlSeo(path, {
    title,
    description,
    path: `${path}${suffix}`,
    canonicalUrl: canonical(`${path}${suffix}`),
    index: pageNo === 1 && !filtered && !!isHubOn(distMin),
    follow: true,
  });
  return filtered ? meta : withPagination(meta, path, pageNo, feed.pages);
}

export default async function DistrictPage({ params, searchParams }: Props) {
  const { category, location, district } = await params;
  const sp = await searchParams;
  const rawPage = typeof sp.page === "string" ? sp.page : undefined;
  if (sp.page !== undefined && (rawPage === undefined || !/^[1-9]\d*$/.test(rawPage))) notFound();
  const page = Math.max(1, Number(rawPage) || 1);
  const [cat, city, districtRows] = await Promise.all([
    getCategory(category),
    getCityBySlug(location),
    getDistricts(location),
  ]);
  const dist = districtRows.find((row) => row.slug === district);
  if (cat && city && !dist) return <SubHub params={{ category, location, district }} page={page} />;
  if (!cat || !city || !dist) notFound();
  const distMin = districtMinimum(await getIndexing(), cat, city.slug || location);
  if (isCityAlias(city.name, dist.name)) permanentRedirect(placePath(cat.slug || category, city.slug || location));
  if (cat.slug !== category || city.slug !== location || dist.slug !== district) {
    permanentRedirect(placePath(cat.slug || category, city.slug || location, dist.slug || district));
  }
  const canonicalPath = placePath(cat.slug || category, city.slug || location, dist.slug || district);
  const { picks, toggles, filter: narrow } = narrowFromParams(sp, cat.fields);
  const filter: Record<string, unknown> = { categorySlug: category, citySlug: location, districtSlug: district, ...narrow };
  const [seo, site, stars, feed, districts, paths, tags, heading, shell, hero, categories, states, cities, cardWidth] = await Promise.all([
    getSeoFor("district", category, "location"),
    getSite(),
    getStarListings(filter),
    getFeed(filter, page),
    getDistricts(city.slug || location),
    getPaths(),
    publicTags(),
    urlHeading(canonicalPath, ""),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    getCategories(),
    getStates(),
    getCities(),
    loadCardWidth(),
  ]);
  if (pageOutOfRange(rawPage, feed.pages)) notFound();
  const thin = !isHubOn(distMin);
  const districtCopy = fallbackLanding({
    category: cat.name || category,
    city: city.name || location,
    district: dist.name || district,
    count: feed.total,
    site: site.name,
    indexable: !thin,
    updated: feed.items[0]?.publishedAt
      ? new Date(feed.items[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : undefined,
  });
  const vars = {
    category: cat.name,
    city: city.name,
    district: dist.name,
    districtPref: ` / ${dist.name}`,
    site: site.name,
    count: feed.total,
    year: new Date().getFullYear(),
  };
  const layout = await resolveListingLayout({ path: canonicalPath, category: cat.slug || category, vars });
  const texts = await textOverrides();
  const t = makeT(texts);
  const h1 = heading || visibleHeading(fillTemplate(seo?.h1 || "", vars), districtCopy.h1);
  const own = showFallback(feed);
  const fallback = own
    ? await loadFallbackSections({
        scope: { categorySlug: cat.slug || category, categoryName: cat.name || undefined, stateSlug: city.stateSlug || undefined, placeName: city.name },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
        t,
      })
    : [];
  const lead =
    feed.total === 0
      ? { text: t("listing.empty.leadPlace", { place: dist.name || "" }), button: t("listing.empty.buttonPlace", { place: dist.name || "" }), href: postAdPath(paths) }
      : undefined;
  const crumbs = [
        { name: t("listing.crumb.home"), path: "/" },
        { name: cat.name!, path: `/${cat.slug}/` },
        { name: `${prettyPlace(city.stateSlug)} ${cat.name}`, path: placePath(cat.slug || category, city.stateSlug || "") },
        { name: `${city.name} ${cat.name}`, path: placePath(cat.slug || category, city.slug || location) },
        { name: `${dist.name} ${cat.name}`, path: canonicalPath },
      ];
  const labels = listingLabels(t);
  const filterQs = listingFilterQuery(picks, toggles);
  const homeContent = await getHomepageContent();
  const frame = listingFrameProps({
    crumbs,
    h1,
    intro: t("listing.band.introPlace", { category: introCategory(cat.name), place: `${dist.name}, ${city.name}` }),
    photo: bandChoice(shell, hero, { city: city.slug || location, category: cat.slug || category }),
    categorySlug: cat.slug || category,
    citySlug: city.slug || location,
    searchAction: placePath(cat.slug || category, city.slug || location),
    searchPlaceholder: `Search ${cat.name} in ${dist.name}`,
    chips: null,
    fields: cat.fields,
    picks,
    toggles,
    panelPath: canonicalPath,
    total: feed.total,
    labels,
    showBand: homeContent.showListingBand || hasOwnBand(shell, { city: city.slug || location, category: cat.slug || category }),
    template: {
      state: {
        category: { slug: cat.slug || category, name: cat.name || category },
        city: { slug: city.slug || location, name: city.name || location },
        area: { slug: dist.slug || district, name: dist.name || district },
        toggles,
        picks,
        fields: cat.fields,
      },
      crumbs,
      h1,
      total: feed.total,
      nearby: own,
      placeName: dist.name || undefined,
      pagePath: canonicalPath,
      t,
    },
    places: placeSelects({
      categorySlug: cat.slug || category,
      categories,
      states,
      cities,
      districts,
      stateSlug: city.stateSlug || undefined,
      citySlug: city.slug || location,
      districtSlug: dist.slug || district,
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
      texts={texts}
      layout={layout}
      pageName={h1}
      faqs={districtCopy.faqs}
      popular={tags.slice(0, 4).map((tag) => ({ href: tagPath(paths, cat.slug || category, tag.slug), label: `${dist.name} ${tag.label}` }))}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={districtCopy.intro || fillTemplate(seo?.intro || "", vars)}
      crumbs={crumbs}
      districts={districts.map((d) => ({ href: placePath(cat.slug || category, city.slug || location, d.slug || ""), label: d.name! }))}
      path={`${canonicalPath}${filterQs ? `?${filterQs}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={thin || page > 1 || (Boolean(filterQs) && feed.total === 0)}
      siblingLinks={districts
        .filter((row) => row.slug !== dist.slug)
        .slice(0, 4)
        .map((row) => ({
          href: placePath(cat.slug || category, city.slug || location, row.slug || ""),
          label: t("listing.link.in", { name: cat.name, place: `${row.name}, ${city.name}` }),
        }))
        .concat([{ href: placePath(cat.slug || category, city.slug || location), label: t("listing.link.in", { name: cat.name, place: city.name }) }])
        .slice(0, 5)}
      emptyNearby={[{ href: placePath(cat.slug || category, city.slug || location), label: city.name! }]}
      hideEmpty={feed.total === 0}
      fallback={own ? <FallbackAds sections={fallback} lead={lead} layout="row" /> : undefined}
    />
    </ListingFrame>
    </div>
  );
}
