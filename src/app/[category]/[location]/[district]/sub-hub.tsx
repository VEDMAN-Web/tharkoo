import { notFound, permanentRedirect } from "next/navigation";
import { withPagination } from "@/lib/seo/pagination";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { NewListingPage } from "@/components/new/ListingBand";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";
import { listingLabels } from "@/components/new/listing-frame-props";
import { FallbackAds } from "@/components/FallbackAds";
import { loadFallbackSections, showFallback } from "@/lib/fallback-ads";
import { readShellConfig } from "@/server/site-links/shell-config";
import { getPaths } from "@/server/urls/service";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { getCategory, getCityBySlug, getHomepageContent, getSite } from "@/lib/queries";
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
  const [site, feed, siblings, texts, heading, shell, hero, paths] = await Promise.all([
    getSite(),
    subcategoryFeed({ categoryId: String(hub.cat._id), cityId: hub.cityId, subcategoryId: hub.sub.id, page }),
    subcategoryChips(catSlug, citySlug),
    textOverrides(),
    urlHeading(canonicalPath, ""),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    getPaths(),
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
      })
    : [];
  const lead =
    feed.total === 0
      ? { text: `No ads in ${hub.city.name} yet. Here are ads close by.`, button: `Post the first ad in ${hub.city.name}`, href: postAdPath(paths) }
      : undefined;
  return (
    <NewListingPage
      tk="sub-hub"
      band={{
        crumbs,
        h1,
        photo: bandChoice(shell, hero, { city: citySlug, category: catSlug }),
        categorySlug: catSlug,
        citySlug,
        searchAction: placePath(catSlug, citySlug),
        placeholder: `Search ${hub.cat.name} in ${hub.city.name}`,
        labels: listingLabels(t),
      }}
    >
    <ListingPageView
      frame
      layout={layout}
      texts={texts}
      h1={h1}
      faqs={copy.faqs}
      intro={copy.intro}
      crumbs={crumbs}
      cityName={hub.city.name}
      categoryName={hub.sub.name}
      locationLabel={hub.city.name}
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
    </NewListingPage>
  );
}
