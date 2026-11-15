import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import {
  getCategories,
  getCategory,
  getCities,
  getStates,
  getDistricts,
  getFeed,
  getLocationBySlug,
  getSeoFor,
  getSiblingCities,
  getSite,
  getStarListings,
  isThin,
  listingCountsByCategoryCity,
  pageOutOfRange,
} from "@/lib/queries";
import { prettyPlace } from "@/lib/format";
import { getIndexing, hubMinimum } from "@/server/seo/indexing";
import { canonical, fillTemplate } from "@/lib/seo";
import { placePath, searchPath, tagPath } from "@/lib/urls";
import { activeFilterKeys, listingCanonicalSuffix } from "@/server/search/filter-seo";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { hubCopy } from "@/lib/seo-site";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { getPaths, publicTags } from "@/server/urls/service";
import { fallbackLanding, mergeLanding, visibleHeading, type LandingCopy } from "@/lib/seo/landing";
import { isCityAlias } from "@/lib/seo/district-alias";
import { SubcategoryChips } from "../SubcategoryChips";
import { loadCardWidth } from "@/server/listings/card-width";
import { newDesignOn } from "@/server/site-links/new-design";
import { readShellConfig } from "@/server/site-links/shell-config";
import { bandImageFor } from "@/components/new/band-image";
import { ListingFrame } from "@/components/new/ListingFrame";
import { listingFrameProps } from "@/components/new/listing-frame-props";
import { attributePicks, hasFieldPicks, listingFilterQuery, type ListingToggles } from "@/components/new/listing-filters";
import { listingLabels, placeSelects } from "@/components/new/listing-frame-props";
import { listingHeading } from "@/lib/layout/listing";
import { type ListingParams } from "@/server/search/filter-seo";

type Props = {
  params: Promise<{ category: string; location: string }>;
  searchParams: Promise<ListingParams & { page?: string; photos?: string; verified?: string }>;
};

export const revalidate = 60;

function landingFor(
  site: { name?: string; landings?: Record<string, Partial<LandingCopy>> },
  input: { category: string; city: string; count: number; indexable?: boolean; districts?: string[]; updated?: string },
) {
  const fallback = fallbackLanding({ ...input, site: site.name });
  return mergeLanding(fallback, site.landings?.[`${input.category.toLowerCase()}|${input.city.toLowerCase()}`]);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, location } = await params;
  const sp = await searchParams;
  const [cat, loc, seo, site] = await Promise.all([
    getCategory(category),
    getLocationBySlug(location),
    getSeoFor("location", category),
    getSite(),
  ]);
  if (!cat || !loc) return {};
  const hubMin = hubMinimum(await getIndexing(), cat, loc.slug || location);
  const feed = await getFeed(
    loc.kind === "state"
      ? { categorySlug: category, stateSlug: location }
      : { categorySlug: category, citySlug: location },
    1,
  );
  const vars = {
    category: cat.name,
    city: loc.name,
    state: loc.kind === "state" ? loc.name : loc.stateSlug,
    count: feed.total,
    site: site.name,
    year: new Date().getFullYear(),
    districtPref: "",
  };
  const copy = landingFor(site as { name?: string; landings?: Record<string, Partial<LandingCopy>> }, {
    category: cat.name || category,
    city: loc.name || location,
    count: feed.total,
    indexable: !isThin(feed.total, hubMin),
  });
  const title = fillTemplate(seo?.title || copy.title, vars);
  const description = fillTemplate(seo?.description || copy.description, vars);
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const filtered = activeFilterKeys(sp).length > 0;
  const thin = isThin(feed.total, hubMin);
  const clean = placePath(cat.slug || category, loc.slug || location);
  const suffix = listingCanonicalSuffix(sp, pageNo);
  // Filter URLs are noindex, follow, and their canonical is the clean page (see filter-seo.ts).
  return withSeoDefaults(
    await withUrlSeo(clean, {
      title,
      description,
      path: `${clean}${suffix}`,
      canonicalUrl: canonical(`${clean}${suffix}`),
      index: !thin && pageNo === 1 && !filtered,
      follow: true,
    }),
  );
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { category, location } = await params;
  const sp = await searchParams;
  if (pageOutOfRange(sp.page, 1) && !/^[1-9]\d*$/.test(sp.page || "")) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, loc] = await Promise.all([getCategory(category), getLocationBySlug(location)]);
  if (!cat || !loc || (loc.kind !== "city" && loc.kind !== "state")) notFound();
  const hubMin = hubMinimum(await getIndexing(), cat, loc.slug || location);
  if ((cat.slug && cat.slug !== category) || (loc.slug && loc.slug !== location)) {
    permanentRedirect(placePath(cat.slug || category, loc.slug || location));
  }

  const filter =
    loc.kind === "state"
      ? { categorySlug: category, stateSlug: location }
      : { categorySlug: category, citySlug: location };
  if (sp.photos) Object.assign(filter, { photos: { $exists: true, $ne: [] } });
  if (sp.verified) Object.assign(filter, { verified: true });
  if (sp.video === "1") Object.assign(filter, { video: true });
  if (sp.online === "1") Object.assign(filter, { online: true });
  // H7.4b: the field picks from the filter panel (choices, number ranges, yes/no), applied by the listing query.
  const picks = attributePicks(sp, cat.fields);
  const attributes = hasFieldPicks(picks) ? { attributes: picks } : {};
  Object.assign(filter, attributes);

  const canonicalPath = placePath(cat.slug || category, loc.slug || location);
  const [seo, site, stars, feed, siblings, districts, paths, tags, heading, counts, categories, cardWidth, states, cities] = await Promise.all([
    getSeoFor("location", category),
    getSite(),
    getStarListings(loc.kind === "city" ? { categorySlug: category, citySlug: location, ...attributes } : filter),
    getFeed(filter, page),
    loc.kind === "city" && loc.stateSlug ? getSiblingCities(loc.stateSlug) : Promise.resolve([]),
    loc.kind === "city" ? getDistricts(loc.slug || location).then((rows) => rows.filter((row) => !isCityAlias(loc.name, row.name || ""))) : Promise.resolve([]),
    getPaths(),
    publicTags(),
    urlHeading(canonicalPath, ""),
    listingCountsByCategoryCity().catch(() => []),
    getCategories().catch(() => []),
    loadCardWidth(),
    getStates().catch(() => []),
    getCities().catch(() => []),
  ]);
  if (sp.page && Number(sp.page) > feed.pages) notFound();

  const stateName = prettyPlace(loc.stateSlug) || loc.name;
  const vars = {
    category: cat.name,
    city: loc.name,
    state: stateName,
    count: feed.total,
    site: site.name,
    year: new Date().getFullYear(),
    districtPref: "",
  };
  const names = new Map(categories.map((row) => [row.slug, row.name || row.slug || ""]));
  const live = counts.filter((row) => row.n > 0);
  const sameCategory = live.filter((row) => row._id.categorySlug === (cat.slug || category) && row._id.citySlug !== loc.slug).slice(0, 3);
  const otherHere = live.filter((row) => row._id.citySlug === loc.slug && row._id.categorySlug !== (cat.slug || category)).slice(0, 2);
  const copy = landingFor(site as { name?: string; landings?: Record<string, Partial<LandingCopy>> }, {
    category: cat.name || category,
    city: loc.name || location,
    count: feed.total,
    indexable: !isThin(feed.total, hubMin),
    districts: districts.map((row) => row.name || "").filter(Boolean).slice(0, 3),
    updated: feed.items[0]?.publishedAt ? new Date(feed.items[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : undefined,
  });
  const texts = await textOverrides();
  const hub = await hubCopy(canonicalPath, { intro: copy.intro || fillTemplate(seo?.intro || "", vars), faqs: copy.faqs });
  const t = makeT(texts);
  const filtered = Boolean(sp.photos || sp.verified);
  const siblingLinks = [
    ...sameCategory.map((row) => ({
      href: placePath(cat.slug || category, row._id.citySlug),
      label: t("listing.link.in", { name: cat.name, place: prettyPlace(row._id.citySlug) }),
    })),
    ...otherHere.map((row) => ({
      href: placePath(row._id.categorySlug, loc.slug || location),
      label: t("listing.link.in", { name: names.get(row._id.categorySlug) || row._id.categorySlug, place: loc.name }),
    })),
  ].slice(0, 5);
  const newest = feed.items[0]?.publishedAt;
  const updated = newest && !isThin(feed.total, hubMin)
    ? new Date(newest).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : undefined;

  const [layout, newDesign] = await Promise.all([resolveListingLayout({ path: canonicalPath, category: cat.slug || category, vars }), newDesignOn()]);
  // H7.4: the New design title band (image, search bar and chips) replaces the chips that sit under the list.
  const shell = newDesign ? await readShellConfig() : null;
  const citySlug = loc.slug || location;
  const categorySlug = cat.slug || category;

  const crumbs = [
    { name: t("listing.crumb.home"), path: "/" },
    { name: cat.name!, path: `/${cat.slug}/` },
    ...(loc.stateSlug ? [{ name: `${stateName} ${cat.name}`, path: placePath(cat.slug || category, loc.stateSlug) }] : []),
    { name: `${loc.name} ${cat.name}`, path: canonicalPath },
  ];
  const h1 = heading || visibleHeading(fillTemplate(seo?.h1 || "", vars), copy.h1);
  const toggles: ListingToggles = { verified: sp.verified === "1", photos: sp.photos === "1", video: sp.video === "1", online: sp.online === "1" };
  const filterQs = listingFilterQuery(picks, toggles);
  const listing = (
    <ListingPageView
      frame={Boolean(shell)}
      layout={layout}
      texts={texts}
      h1={h1}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={hub.intro}
      faqs={hub.faqs}
      popular={tags.slice(0, 6).map((tag) => ({ href: tagPath(paths, cat.slug || category, tag.slug), label: `${cat.name} ${tag.label}` }))}
      footer={fillTemplate(seo?.footer || "", vars)}
      crumbs={crumbs}
      locationLabel={`${stateName} - ${loc.name}`}
      cityName={loc.name}
      categoryName={cat.name}
      districts={districts.map((d) => ({ href: placePath(cat.slug || category, loc.slug || location, d.slug || ""), label: d.name! }))}
      path={`${canonicalPath}${filterQs ? `?${filterQs}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total, hubMin) || page > 1 || (filtered && feed.total === 0)}
      updated={updated}
      siblingLinks={siblingLinks}
      emptyNearby={siblings.slice(0, 6).map((c) => ({ href: placePath(cat.slug || category, c.slug || ""), label: c.name! }))}
      photos={toggles.photos}
      verified={toggles.verified}
    />
  );
  if (!shell) {
    return (
      <>
        <div data-card-width={cardWidth}>{listing}</div>
        {loc.kind === "city" && !newDesign ? <SubcategoryChips category={cat.slug || category} city={loc.slug || location} /> : null}
      </>
    );
  }
  // H7.4b: New design. The title band and the filter panel frame the list; the ads and the blocks below go in the list column.
  const introTemplate = String(layout.blocks.find((block) => block.type === "listingHeader")?.props.introTemplate ?? "");
  const labels = listingLabels(t);
  const places = placeSelects({
    categorySlug,
    categories,
    states,
    cities,
    districts,
    stateSlug: loc.kind === "city" ? loc.stateSlug || undefined : loc.kind === "state" ? loc.slug || location : undefined,
    citySlug: loc.kind === "city" ? citySlug : undefined,
    labels,
  });
  const frame = listingFrameProps({
    crumbs,
    h1,
    intro: listingHeading(introTemplate, "", { ...layout.vars, h1 }) || undefined,
    image: bandImageFor(shell, categorySlug, loc.kind === "city" ? citySlug : undefined),
    categorySlug,
    citySlug: loc.kind === "city" ? citySlug : undefined,
    searchAction: searchPath(paths),
    searchPlaceholder: t("listing.band.searchPlaceholder", { category: cat.name, place: loc.name }),
    chips: loc.kind === "city" ? <SubcategoryChips variant="band" category={categorySlug} city={citySlug} /> : null,
    fields: cat.fields,
    picks,
    toggles,
    panelPath: canonicalPath,
    labels,
    places,
  });
  return (
    <div data-card-width={cardWidth}>
      <ListingFrame
        bandStyle={frame.bandStyle}
        labels={labels}
        head={frame.head}
        chips={frame.chips}
        searchForm={frame.searchForm}
        filters={frame.filters}
        activeCount={frame.activeCount}
      >
        {listing}
      </ListingFrame>
    </div>
  );
}
