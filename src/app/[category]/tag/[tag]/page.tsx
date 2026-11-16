import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import { ListingFrame } from "@/components/new/ListingFrame";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";
import { listingFrameProps, listingLabels, placeSelects } from "@/components/new/listing-frame-props";
import { listingFilterQuery } from "@/components/new/listing-filters";
import { narrowFromParams } from "@/components/new/listing-narrow";
import { loadCardWidth } from "@/server/listings/card-width";
import type { ListingParams } from "@/server/search/filter-seo";
import { FallbackAds } from "@/components/FallbackAds";
import { getCategories, getCategory, getCities, getFeed, getHomepageContent, getSite, getStates, pageOutOfRange } from "@/lib/queries";
import { canonical } from "@/lib/seo";
import { withPagination } from "@/lib/seo/pagination";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { readShellConfig } from "@/server/site-links/shell-config";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { categoryPath, postAdPath, searchPath, tagPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths, publicTags } from "@/server/urls/service";

export const revalidate = 300;

async function tagLabel(tag: string) {
  const tags = await publicTags();
  return tags.find((item) => item.slug === tag) || null;
}

type Props = { params: Promise<{ category: string; tag: string }>; searchParams: Promise<ListingParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, tag } = await params;
  const sp = await searchParams;
  const [meta, cat, paths] = await Promise.all([tagLabel(tag), getCategory(category), getPaths()]);
  const path = tagPath(paths, cat?.slug || category, tag);
  if (!cat || !meta) {
    return withUrlSeo(path, {
      title: "Page not found | Tharkoo",
      description: "That tag page is not on Tharkoo. Browse a category from the home page instead.",
      path,
      index: false,
      follow: false,
    });
  }
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const suffix = pageNo > 1 ? `?page=${pageNo}` : "";
  const result = await withUrlSeo(path, {
    title: `${meta.label} ${cat.name} ads | Tharkoo`,
    description: `Browse ${cat.name} ads tagged ${meta.label} on Tharkoo. Open a listing to see the details, photos, and how to get in touch.`,
    path: `${path}${suffix}`,
    canonicalUrl: canonical(`${path}${suffix}`),
    index: false,
    follow: true,
  });
  const feed = await getFeed({ categorySlug: category, tag }, 1);
  return withPagination(result, path, pageNo, feed.pages);
}

export default async function TagPage({ params, searchParams }: Props) {
  const { category, tag } = await params;
  const sp = await searchParams;
  const rawPage = typeof sp.page === "string" ? sp.page : undefined;
  if (sp.page !== undefined && rawPage === undefined) notFound();
  const page = Math.max(1, Number(rawPage) || 1);
  const [meta, cat, paths] = await Promise.all([tagLabel(tag), getCategory(category), getPaths()]);
  if (!cat || !meta) notFound();
  const { picks, toggles, filter: narrow } = narrowFromParams(sp, cat.fields);
  const path = tagPath(paths, cat.slug || category, tag);
  const [site, feed, tags, heading, shell, hero, texts, categories, states, cities, cardWidth] = await Promise.all([
    getSite(),
    getFeed({ categorySlug: category, tag, ...narrow }, page),
    publicTags(),
    urlHeading(path, `${meta.label} ${cat.name}`),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    textOverrides(),
    getCategories(),
    getStates(),
    getCities(),
    loadCardWidth(),
  ]);
  if (pageOutOfRange(rawPage, feed.pages)) notFound();
  const t = makeT(texts);
  const own = showFallback(feed);
  const fallback = own
    ? await loadFallbackSections({
        scope: { categorySlug: cat.slug || category, categoryName: cat.name || undefined },
        ownSlugs: feed.items.map((ad) => ad.slug || "").filter(Boolean),
      })
    : [];
  const crumbs = [
    { name: "India", path: "/" },
    { name: cat.name!, path: `/${cat.slug}/` },
    { name: meta.label, path },
  ];
  const lead =
    feed.total === 0
      ? { text: `No ${meta.label} ${cat.name} ads yet. Here are ads close by.`, button: `Post the first ad in ${cat.name}`, href: postAdPath(paths) }
      : undefined;
  const labels = listingLabels(t);
  const filterQs = listingFilterQuery(picks, toggles);
  const homeContent = await getHomepageContent();
  const frame = listingFrameProps({
    crumbs,
    h1: heading,
    intro: `${site.name} lists ${cat.name} ads tagged ${meta.label}. ${feed.total} ads match this search.`,
    photo: bandChoice(shell, hero, { category: cat.slug || category }),
    categorySlug: cat.slug || category,
    searchAction: searchPath(paths),
    searchPlaceholder: `Search ${cat.name} ads`,
    chips: null,
    fields: cat.fields,
    picks,
    toggles,
    panelPath: path,
    total: feed.total,
    labels,
    showBand: homeContent.showListingBand,
    template: {
      state: { category: { slug: cat.slug || category, name: cat.name || category }, toggles, picks, fields: cat.fields },
      crumbs,
      h1: heading,
      total: feed.total,
      nearby: own,
      pagePath: path,
      extraChips: [{ key: "tag", label: `Tag: ${meta.label}`, removeLabel: `Remove Tag: ${meta.label}`, href: categoryPath(cat.slug || category) }],
      t,
    },
    places: placeSelects({ categorySlug: cat.slug || category, categories, states, cities, districts: [], labels }),
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
        crumbs={crumbs}
        path={`${path}${filterQs ? `?${filterQs}` : ""}`}
        stars={[]}
        items={feed.items}
        page={page}
        pages={feed.pages}
        total={feed.total}
        noindex={feed.total < 1}
        siblingLinks={tags.filter((item) => item.slug !== tag).slice(0, 8).map((item) => ({ href: tagPath(paths, cat.slug || category, item.slug), label: item.label }))}
        emptyNearby={[]}
        popular={tags.slice(0, 6).map((item) => ({ href: tagPath(paths, cat.slug || category, item.slug), label: item.label }))}
        hideEmpty={feed.total === 0}
        fallback={own ? <FallbackAds sections={fallback} lead={lead} layout="row" /> : undefined}
      />
    </ListingFrame>
    </div>
  );
}
