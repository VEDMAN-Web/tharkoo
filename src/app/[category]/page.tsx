import { sampleNoteText } from "@/lib/seo/sample-note";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getCategories, getCategory, getCities, getFeed, getHomepageContent, getSeoFor, getSite, getStarListings, getStates, listingCountsByCategoryCity, pageOutOfRange } from "@/lib/queries";
import { getPaths } from "@/server/urls/service";
import { popularSearches } from "@/lib/seo/local-links";
import { adHref, categoryPath, placePath, postAdPath, searchPath } from "@/lib/urls";
import { ListingLinkNav } from "@/components/new/ListingLinkNav";
import { fillTemplate } from "@/lib/seo";
import { getIndexing, isCategoryOn } from "@/server/seo/indexing";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { hubCopy } from "@/lib/seo-site";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { itemListNode, webPageNode } from "@/lib/seo/schema";
import { canonical } from "@/lib/seo";
import { AdCard, UiTextProvider } from "@/components/ui/AdCard";
import { ListingCard, ListingGrid } from "@/components/new/ListingCards";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT, pickTexts } from "@/lib/ui/text";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { deviceClass } from "@/components/blocks/device";
import { listingHeading } from "@/lib/layout/listing";
import { hourSeed, orderFeed } from "@/components/feedOrder";
import { fallbackLanding, mergeLanding, type LandingCopy } from "@/lib/seo/landing";
import { SubcategoryChips } from "./SubcategoryChips";
import { loadCardWidth } from "@/server/listings/card-width";
import { activeFilterKeys, listingCanonicalSuffix, listingRobots, type ListingParams } from "@/server/search/filter-seo";
import { readShellConfig } from "@/server/site-links/shell-config";
import { bandChoice, hasOwnBand, heroBandFrom } from "@/components/new/band-image";
import { FallbackAds } from "@/components/FallbackAds";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { ListingFrame } from "@/components/new/ListingFrame";
import { pagedText, withPagination } from "@/lib/seo/pagination";
import { resolveListingCopy } from "@/server/content/listing-copy";
import { ListingPager } from "@/components/new/ListingPager";
import { pageBase, pagerLabels } from "@/components/new/listing-pager";
import { introCategory, listingFrameProps, listingLabels, placeSelects } from "@/components/new/listing-frame-props";
import { attributePicks, hasFieldPicks, type ListingToggles } from "@/components/new/listing-filters";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<ListingParams> };

export const revalidate = 300;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  const sp = await searchParams;
  const robots = listingRobots(sp);
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeoFor("category", category), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const path = categoryPath(cat.slug || category);
  const fromContent = (site as { listingCopySource?: string }).listingCopySource === "content";
  const resolved = fromContent ? await resolveListingCopy({ kind: "category", path, categorySlug: cat.slug || category, category: cat.name || category, count: 0, mode: "content" }) : null;
  const baseTitle = resolved?.title ?? fillTemplate(seo?.title || "{category} classifieds across India | Tharkoo", vars);
  const description = resolved?.description ?? fillTemplate(seo?.description || "Browse {category} on Tharkoo: listings from people across Indian cities. Filter by city and district, see photos and contact posters directly.", vars);
  const on = isCategoryOn(await getIndexing(), cat.slug || category);
  const pageNo = Math.max(1, Number(sp.page) || 1);
  // H17.3: page 2 and later say so in the title (and in the heading below).
  const title = pagedText(baseTitle, pageNo);
  const suffix = listingCanonicalSuffix(sp, pageNo);
  const meta = await withSeoDefaults(
    await withUrlSeo(path, { title, description, path: `${path}${suffix}`, canonicalUrl: canonical(`${path}${suffix}`), index: on && robots.index, follow: robots.follow }),
  );
  if (activeFilterKeys(sp).length > 0) return meta;
  const feed = await getFeed({ categorySlug: category }, 1);
  return withPagination(meta, path, pageNo, feed.pages);
}

export default async function CategoryHub({ params, searchParams }: Props) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  if (cat.slug && cat.slug !== category) permanentRedirect(categoryPath(cat.slug));
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  // H7.4b: the filter panel's field picks and quick toggles narrow the feed the same way they do on a city page.
  const picks = attributePicks(sp, cat.fields);
  const toggles: ListingToggles = { verified: sp.verified === "1", photos: sp.photos === "1", video: sp.video === "1", online: sp.online === "1" };
  const narrow = {
    categorySlug: category,
    ...(hasFieldPicks(picks) ? { attributes: picks } : {}),
    ...(toggles.verified ? { verified: true } : {}),
    ...(toggles.photos ? { photos: { $exists: true, $ne: [] } } : {}),
    ...(toggles.video ? { video: true } : {}),
    ...(toggles.online ? { online: true } : {}),
  };
  const [seo, site, cities, states, counts, feed, stars, paths, heading, cardWidth, allCategories, hero] = await Promise.all([
    getSeoFor("category", category),
    getSite(),
    getCities(),
    getStates(),
    listingCountsByCategoryCity().catch(() => []),
    getFeed(narrow, page),
    getStarListings(narrow).catch(() => []),
    getPaths(),
    urlHeading(categoryPath(cat.slug || category), `${cat.name} in India`),
    loadCardWidth(),
    getCategories().catch(() => []),
    getHomepageContent().then(heroBandFrom),
  ]);
  if (pageOutOfRange(sp.page as string | undefined, feed.pages)) notFound();
  // H7.32: the New design band on every category page, always.
  const shell = await readShellConfig();
  const texts = await textOverrides();
  const t = makeT(texts);
  const homeContent = await getHomepageContent();
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const copy = mergeLanding(
    fallbackLanding({ category: cat.name || category, count: feed.realTotal, site: site.name, sampleNote: await sampleNoteText() }),
    (site as { landings?: Record<string, Partial<LandingCopy>> }).landings?.[`${category}|india`],
  );
  // H8.32: with the switch "content" the words come from the listing copy resolver (the content editor first); otherwise from today's sources.
  const resolved =
    (site as { listingCopySource?: string }).listingCopySource === "content"
      ? await resolveListingCopy({ kind: "category", path: categoryPath(cat.slug || category), categorySlug: cat.slug || category, category: cat.name || category, count: feed.realTotal, mode: "content" })
      : null;
  const hub = resolved ? { intro: resolved.intro, faqs: resolved.faqs } : await hubCopy(categoryPath(cat.slug || category), { intro: copy.intro || fillTemplate(seo?.intro || "", vars), faqs: copy.faqs });
  // H17.4: Popular searches are real category + city pages that have ads, in other categories (this category's own cities are the Nearby list).
  const popularLinks = popularSearches(counts, new Map(allCategories.map((row) => [row.slug || "", row.name || ""])), new Map(cities.map((row) => [row.slug || "", row.name || ""])), { excludeCategory: cat.slug || category, max: 6 });
  const allowed = new Set(counts.filter((row) => row._id.categorySlug === category && row.n > 0).map((row) => row._id.citySlug));
  const listed = allowed.size ? cities.filter((city) => allowed.has(city.slug || "")) : cities;
  const ads = [
    ...(page === 1 ? stars : []),
    ...orderFeed(feed.items.filter((ad) => !stars.some((star) => star.slug && star.slug === ad.slug)), hourSeed()),
  ];
  const layout = await resolveListingLayout({ path: categoryPath(cat.slug || category), category: cat.slug || category, vars: { ...vars, count: feed.realTotal } });
  const headerBlock = layout.blocks.find((block) => block.type === "listingHeader");
  const h1Text = pagedText(resolved ? resolved.h1 : listingHeading(String(headerBlock?.props.h1Template ?? ""), heading, { ...layout.vars, h1: heading }), page);
  const wrap = (id: string, devices: Parameters<typeof deviceClass>[0], content: React.ReactNode) => {
    const cls = deviceClass(devices);
    return cls ? <div key={id} className={cls}>{content}</div> : <span key={id} style={{ display: "contents" }}>{content}</span>;
  };
  // H7.32 (FIX B): few own ads keep their place, and fallback ads go below them. Nothing is empty.
  const own = showFallback(feed);
  const fallback = own
    ? await loadFallbackSections({
        scope: { categorySlug: cat.slug || category, categoryName: cat.name || undefined },
        ownSlugs: ads.map((ad) => ad.slug || "").filter(Boolean),
        t,
      })
    : [];
  const emptyLead =
    feed.total === 0
      ? { text: t("listing.empty.leadIndia", { category: cat.name || "" }), button: t("listing.empty.buttonIndia"), href: postAdPath(paths) }
      : undefined;
  const fallbackNode = own ? <FallbackAds sections={fallback} layout="row" lead={emptyLead} /> : null;
  const feedAndText = (
    <>
      {shell ? (
        <ListingGrid label={t("listing.feed.label")}>
          {ads.map((ad, index) => (
            <li key={ad.publicId || ad.slug || index}>
              <ListingCard ad={ad} order={index} texts={texts} />
            </li>
          ))}
        </ListingGrid>
      ) : (
        <div className="tk-feed" data-tk="category-feed">
          {ads.map((ad, index) => (
            <AdCard key={ad.publicId || ad.slug || index} ad={ad} featured={page === 1 && index < stars.length} priority={index === 0} />
          ))}
        </div>
      )}
      <ListingPager base={pageBase(categoryPath(cat.slug || category), sp)} page={page} pages={feed.pages} total={feed.total} size={feed.pageSize} labels={pagerLabels(t)} />
      {fallbackNode}
      <section className="tk-browse-city" data-tk="browse-by-city">
        <h2>{t("listing.hub.browseByCity")}</h2>
        <div className="tk-pills tk-pills-left">
          {states.flatMap((state) =>
            listed
              .filter((city) => city.stateSlug === state.slug)
              .map((city) => (
                <Link key={city.slug} href={placePath(cat.slug || category, city.slug || "")} className="tk-pill" prefetch={false}>
                  {city.name}
                </Link>
              )),
          )}
        </div>
      </section>
      <div className="tkn-ls-seo">
        <p className="tk-seo-foot">{hub.intro}</p>
        {hub.faqs.map((item) => (
          <p key={item.q} className="tk-seo-foot">
            <strong>{item.q}</strong> {item.a}
          </p>
        ))}
      </div>
    </>
  );
  const inFeedId = String(layout.blocks.find((block) => block.type === "listingFeed")?.props.inFeedBlockId ?? "");
  // Blocks in the order the layout gives. The category page draws the ads and the SEO text itself (the ads come with the text below them).
  // The filter panel is part of the title band and the area links belong to city pages, so those are skipped here; related searches and nearby cities are drawn (H8.32).
  const linkProps = (block: { props: Record<string, unknown> }, fallbackTitle: string, fallbackMax: number) => ({
    title: typeof block.props.title === "string" && block.props.title.trim() ? block.props.title : fallbackTitle,
    max: Number(block.props.max) || fallbackMax,
  });
  const body = layout.blocks.map((block) => {
    if (block.type === "listingFeed") return wrap(block.id, block.devices, feedAndText);
    if (block.type === "relatedCategories") {
      const { title, max } = linkProps(block, t("listing.links.popular"), 6);
      return wrap(block.id, block.devices, <ListingLinkNav title={title} label={t("listing.links.popular")} max={max} links={popularLinks.map((link) => ({ href: placePath(link.categorySlug, link.citySlug), label: t("listing.link.in", { name: link.categoryName, place: link.cityName }) }))} />);
    }
    if (block.type === "nearbyCities") {
      const { title, max } = linkProps(block, t("listing.links.nearby"), 5);
      return wrap(block.id, block.devices, <ListingLinkNav title={title} label={t("listing.links.nearby")} max={max} links={listed.map((city) => ({ href: placePath(cat.slug || category, city.slug || ""), label: t("listing.link.in", { name: cat.name || "", place: city.name || "" }) }))} />);
    }
    if (["listingHeader", "filters", "districtLinks"].includes(block.type)) return null;
    return block.id === inFeedId ? null : wrap(block.id, block.devices, layout.nodes[block.id] ?? null);
  });
  // H7.4b: New design. The title band and the filter panel frame the list.
  const introTemplate = String(headerBlock?.props.introTemplate ?? "");
  const labels = listingLabels(t);
  const places = placeSelects({
    categorySlug: cat.slug || category,
    categories: allCategories,
    states,
    cities,
    districts: [],
    labels,
  });
  const frame = shell
    ? listingFrameProps({
        crumbs: [
          { name: t("listing.crumb.home"), path: "/" },
          { name: cat.name || category, path: categoryPath(cat.slug || category) },
        ],
        h1: h1Text,
        intro: listingHeading(introTemplate, "", { ...layout.vars, h1: h1Text }) || t("listing.band.introIndia", { category: introCategory(cat.name) }),
        photo: bandChoice(shell, hero, { category: cat.slug || category }),
        categorySlug: cat.slug || category,
        searchAction: searchPath(paths),
        searchPlaceholder: t("listing.band.searchCategory", { category: cat.name }),
        chips: <SubcategoryChips variant="band" category={cat.slug || category} />,
        fields: cat.fields,
        picks,
        toggles,
        panelPath: categoryPath(cat.slug || category),
        total: feed.total,
        labels,
        places,
        showBand: homeContent.showListingBand || hasOwnBand(shell, { category: cat.slug || category }),
        template: {
          state: { category: { slug: cat.slug || category, name: cat.name || category }, toggles, picks, fields: cat.fields },
          crumbs: [
            { name: t("listing.crumb.home"), path: "/" },
            { name: cat.name || category, path: categoryPath(cat.slug || category) },
          ],
          h1: h1Text,
          total: feed.total,
          nearby: own,
          pagePath: categoryPath(cat.slug || category),
          t,
        },
      })
    : null;

  return (
    <UiTextProvider texts={pickTexts(texts, "card.")}>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: t("listing.crumb.home"), path: "/" },
            { name: cat.name || category, path: categoryPath(cat.slug || category) },
          ]),
          webPageNode({ name: h1Text, path: categoryPath(cat.slug || category), siteName: site.name || "Tharkoo" }),
          itemListNode({
            url: canonical(categoryPath(cat.slug || category)),
            items: ads.slice(0, 12).map((ad, index) => ({
              url: canonical(adHref(paths, ad)),
              name: ad.title || "Ad",
              position: index + 1,
            })),
          }),
        ]}
      />
      {frame ? (
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
            {body}
          </ListingFrame>
        </div>
      ) : (
        <>
          <div className="tk-banner">
            <div className="tk-container">
              <h1>{h1Text}</h1>
            </div>
            <MapPin className="tk-banner-pins tk-icon-lg" size={180} color="#fff" aria-hidden />
          </div>
          <div className="tk-container" style={{ paddingBottom: 32 }} data-card-width={cardWidth}>
            <Breadcrumbs crumbs={[{ name: t("listing.crumb.home"), path: "/" }, { name: cat.name!, path: categoryPath(cat.slug || category) }]} />
            {body}
          </div>
          <SubcategoryChips category={cat.slug || category} heading={t("listing.hub.browseBySub")} />
        </>
      )}
    </UiTextProvider>
  );
}
