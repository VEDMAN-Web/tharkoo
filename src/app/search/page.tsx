import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingPageView } from "@/components/ListingPage";
import { FallbackAds } from "@/components/FallbackAds";
import { ListingFrame } from "@/components/new/ListingFrame";
import { SearchBar, SearchChips, SearchTop } from "@/components/new/SearchHeader";
import { searchChips, searchHeading, searchHref, sortFrom } from "@/components/new/search-header";
import { listingFrameProps, listingLabels, searchPlaceSelects } from "@/components/new/listing-frame-props";
import { attributePicks, hasFieldPicks, type ListingToggles } from "@/components/new/listing-filters";
import {
  searchListings,
  getCategories,
  getCities,
  getDistricts,
  getLocationBySlug,
  getStates,
  pageOutOfRange,
} from "@/lib/queries";
import { postAdPath, searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { prettyPlace } from "@/lib/format";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { loadCardWidth } from "@/server/listings/card-width";
import type { ListingParams } from "@/server/search/filter-seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(searchPath(paths), {
    title: "Search classifieds | Tharkoo",
    description: "Search Tharkoo listings by keyword, category, and city.",
    path: searchPath(paths),
    index: false,
  });
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingParams> }) {
  const sp = await searchParams;
  const rawPage = one(sp.page);
  if (rawPage !== undefined && !/^[1-9]\d*$/.test(rawPage)) notFound();
  const q = one(sp.q);
  const categorySlug = one(sp.category);
  const city = one(sp.city) || one(sp.location);
  const state = one(sp.state);
  const area = one(sp.area);
  const sort = sortFrom(one(sp.sort));
  const toggles: ListingToggles = { verified: one(sp.verified) === "1", photos: one(sp.photos) === "1", video: one(sp.video) === "1", online: one(sp.online) === "1" };
  const categories = await getCategories();
  const category = categories.find((cat) => cat.slug === categorySlug);
  const picks = attributePicks(sp, category?.fields);
  const feedPromise = searchListings({
    q,
    category: categorySlug,
    location: city,
    state,
    area,
    photos: toggles.photos,
    verified: toggles.verified,
    video: toggles.video,
    online: toggles.online,
    ...(category && hasFieldPicks(picks) ? { attributes: picks } : {}),
    ...(sort === "newest" ? { sort: "fresh" as const } : {}),
    ...(sort === "online" || sort === "verified" ? { prefer: sort } : {}),
    page: Number(rawPage) || 1,
  });
  const params: Record<string, string> = {};
  if (q) params.q = q;
  if (categorySlug) params.category = categorySlug;
  if (city) params.city = city;
  if (state) params.state = state;
  if (area) params.area = area;
  if (sort) params.sort = sort;
  const qs = new URLSearchParams(params);
  for (const key of ["photos", "verified", "video", "online"] as const) if (toggles[key]) qs.set(key, "1");
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith("f.") || value === undefined) continue;
    for (const item of [value].flat()) qs.append(key, item);
  }
  const paths = await getPaths();
  const base = searchPath(paths);
  const path = qs.toString() ? `${base}?${qs.toString()}` : base;
  const [feed, loc, states, cities, districts, texts, cardWidth] = await Promise.all([
    feedPromise,
    city ? getLocationBySlug(city) : Promise.resolve(null),
    getStates(),
    getCities(),
    city ? getDistricts(city) : Promise.resolve([]),
    textOverrides(),
    loadCardWidth(),
  ]);
  if (pageOutOfRange(rawPage, feed.pages)) notFound();
  const t = makeT(texts);
  const labels = listingLabels(t);
  const own = showFallback(feed);
  const placeName = city ? loc?.name || prettyPlace(city) : prettyPlace(state);
  const fallback = own
    ? await loadFallbackSections({
        scope: {
          categorySlug: category?.slug || undefined,
          categoryName: category?.name || undefined,
          stateSlug: state || loc?.stateSlug || undefined,
          placeName,
        },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
      })
    : [];
  const empty = feed.total === 0;
  const lead = empty
    ? {
        text: placeName ? `No ads in ${placeName} yet. Here are ads close by.` : "No ads match your search yet. Here are ads close by.",
        button: placeName ? `Post the first ad in ${placeName}` : "Post an ad",
        href: postAdPath(paths),
      }
    : undefined;
  const pills = q && empty ? categories.slice(0, 6) : [];
  const crumbs = [
    { name: "India", path: "/" },
    { name: "Search", path: base },
  ];
  const named = (rows: { slug?: string | null; name?: string | null }[], slug: string | undefined) => {
    const row = slug ? rows.find((item) => item.slug === slug) : undefined;
    return slug ? { slug, name: row?.name || prettyPlace(slug) } : undefined;
  };
  const searchState = {
    q,
    category: category?.slug ? { slug: category.slug, name: category.name || category.slug } : undefined,
    state: named(states, state),
    city: city ? { slug: city, name: loc?.name || prettyPlace(city) } : undefined,
    area: named(districts, area),
    toggles,
    picks,
    fields: category?.fields,
  };
  const allParams: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of qs.entries()) allParams[key] = [...([allParams[key]].flat().filter(Boolean) as string[]), value];
  const sortValue = sort || (q ? "best" : "newest");
  const sortOptions = [
    ...(q ? [{ value: "best", label: t("search.sort.best"), href: searchHref(base, allParams, ["sort"]) }] : []),
    { value: "newest", label: t("search.sort.newest"), href: q ? searchHref(base, { ...allParams, sort: "newest" }) : searchHref(base, allParams, ["sort"]) },
    { value: "online", label: t("search.sort.online"), href: searchHref(base, { ...allParams, sort: "online" }) },
    { value: "verified", label: t("search.sort.verified"), href: searchHref(base, { ...allParams, sort: "verified" }) },
  ];
  const frame = listingFrameProps({
    crumbs,
    h1: "",
    photo: null,
    categorySlug: category?.slug || "",
    citySlug: city,
    searchAction: base,
    searchPlaceholder: "",
    chips: null,
    fields: category?.fields,
    picks,
    toggles,
    panelPath: base,
    panelHidden: Object.entries(params)
      .filter(([name]) => name !== "q")
      .map(([name, value]) => ({ name, value })),
    keyword: {
      base,
      params,
      defaultValue: q || "",
      label: t("search.keyword.label"),
      placeholder: t("search.keyword.placeholder"),
      listLabel: t("search.keyword.suggestions"),
    },
    labels,
    total: feed.total,
    places: searchPlaceSelects({ searchPath: base, params: { ...params }, categories, states, cities, districts, labels }),
  });
  return (
    <div data-card-width={cardWidth}>
      <ListingFrame
        labels={labels}
        filters={frame.filters}
        activeCount={frame.activeCount}
        header={{
          top: <SearchTop crumbs={crumbs} breadcrumbLabel={labels.breadcrumb} heading={searchHeading(searchState, t)} />,
          bar: <SearchBar total={feed.total} sortValue={sortValue} sortOptions={sortOptions} t={t} />,
          chips: <SearchChips chips={searchChips(base, allParams, searchState, labels, t)} clearHref={base} t={t} />,
        }}
      >
        <ListingPageView
          texts={texts}
          crumbs={crumbs}
          path={path}
          stars={[]}
          items={feed.items}
          page={feed.page}
          pages={feed.pages}
          total={feed.total}
          noindex
          siblingLinks={[]}
          emptyNearby={[]}
          query={q || ""}
          hideEmpty={empty}
          fallback={
            own ? (
              <>
                {pills.length ? (
                  <div className="tk-empty">
                    {pills.map((cat) => (
                      <Link key={cat.slug} href={`/${cat.slug}/`} className="tk-pill" prefetch={false}>
                        {cat.name || cat.slug || "Category"}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <FallbackAds sections={fallback} lead={lead} layout="row" />
              </>
            ) : undefined
          }
        />
      </ListingFrame>
    </div>
  );
}
