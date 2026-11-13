import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { getCategory, getCities, getLocationBySlug, getSite } from "@/lib/queries";
import { fallbackLanding } from "@/lib/seo/landing";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { placePath } from "@/lib/urls";
import { findSubcategory, isSubcategoryIndexable, subcategoryChips, subcategoryFeed } from "@/server/categories/public";
import { Location } from "@/server/models";
import { connectDb } from "@/lib/db";

export type SubHubParams = { category: string; location: string; district: string };

async function resolve({ category, location, district }: SubHubParams) {
  const cat = await getCategory(category);
  if (!cat?._id) return null;
  const found = await findSubcategory(String(cat._id), district);
  if (!found) return null;
  const loc = await getLocationBySlug(location);
  const city = loc?.kind === "city" ? loc : ((await getCities()).find((row) => row.slug === location) ?? null);
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

/** True when the last address part is a sub-category of this category. Used by the district route before it gives up. */
export async function isSubHub(params: SubHubParams) {
  return (await resolve(params)) !== null;
}

export async function subHubMetadata(params: SubHubParams, page: number): Promise<Metadata> {
  const hub = await resolve(params);
  if (!hub) return {};
  const [site, feed] = await Promise.all([getSite(), subcategoryFeed({ categoryId: String(hub.cat._id), cityId: hub.cityId, subcategoryId: hub.sub.id, page: 1 })]);
  const copy = copyFor({
    catName: hub.cat.name || params.category,
    cityName: hub.city.name || params.location,
    subName: hub.sub.name,
    subIntro: hub.sub.seoIntro,
    count: feed.total,
    site: site.name,
    indexable: isSubcategoryIndexable(feed.total),
  });
  const path = placePath(hub.cat.slug || params.category, hub.city.slug || params.location, hub.sub.slug);
  return withUrlSeo(path, {
    title: copy.title,
    description: copy.description,
    path: page > 1 ? `${path}?page=${page}` : path,
    index: isSubcategoryIndexable(feed.total, page),
    follow: true,
  });
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
  const [site, feed, siblings, texts, heading] = await Promise.all([
    getSite(),
    subcategoryFeed({ categoryId: String(hub.cat._id), cityId: hub.cityId, subcategoryId: hub.sub.id, page }),
    subcategoryChips(catSlug, citySlug),
    textOverrides(),
    urlHeading(canonicalPath, ""),
  ]);
  if (page > feed.pages) notFound();
  const t = makeT(texts);
  const copy = copyFor({
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
  return (
    <ListingPageView
      layout={layout}
      texts={texts}
      h1={heading || copy.h1}
      faqs={copy.faqs}
      intro={copy.intro}
      crumbs={[
        { name: t("listing.crumb.home"), path: "/" },
        { name: hub.cat.name!, path: `/${catSlug}/` },
        { name: `${hub.city.name} ${hub.cat.name}`, path: placePath(catSlug, citySlug) },
        { name: `${hub.sub.name} ${hub.city.name}`, path: canonicalPath },
      ]}
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
    />
  );
}
