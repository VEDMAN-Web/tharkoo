import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveListingLayout } from "@/components/blocks/ListingLayout";
import { ListingPageView } from "@/components/ListingPage";
import { makeT } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import {
  getCategories,
  getCategory,
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
import { fillTemplate } from "@/lib/seo";
import { placePath, tagPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths, publicTags } from "@/server/urls/service";
import { fallbackLanding, mergeLanding, visibleHeading, type LandingCopy } from "@/lib/seo/landing";
import { isCityAlias } from "@/lib/seo/district-alias";

type Props = {
  params: Promise<{ category: string; location: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
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
    indexable: !isThin(feed.total, cat.minListingsIndex ?? 3),
  });
  const title = fillTemplate(seo?.title || copy.title, vars);
  const description = fillTemplate(seo?.description || copy.description, vars);
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const filtered = Boolean(sp.photos || sp.verified);
  const thin = isThin(feed.total, cat.minListingsIndex ?? 3);
  const query = new URLSearchParams();
  if (sp.photos) query.set("photos", "1");
  if (sp.verified) query.set("verified", "1");
  if (pageNo > 1) query.set("page", String(pageNo));
  const suffix = query.toString();
  const path = `${placePath(cat.slug || category, loc.slug || location)}${suffix ? `?${suffix}` : ""}`;
  return withUrlSeo(placePath(cat.slug || category, loc.slug || location), {
    title,
    description,
    path,
    index: !thin && pageNo === 1 && !(filtered && feed.total === 0),
    follow: true,
  });
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { category, location } = await params;
  const sp = await searchParams;
  if (pageOutOfRange(sp.page, 1) && !/^[1-9]\d*$/.test(sp.page || "")) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, loc] = await Promise.all([getCategory(category), getLocationBySlug(location)]);
  if (!cat || !loc || (loc.kind !== "city" && loc.kind !== "state")) notFound();
  if ((cat.slug && cat.slug !== category) || (loc.slug && loc.slug !== location)) {
    permanentRedirect(placePath(cat.slug || category, loc.slug || location));
  }

  const filter =
    loc.kind === "state"
      ? { categorySlug: category, stateSlug: location }
      : { categorySlug: category, citySlug: location };
  if (sp.photos) Object.assign(filter, { photos: { $exists: true, $ne: [] } });
  if (sp.verified) Object.assign(filter, { verified: true });

  const canonicalPath = placePath(cat.slug || category, loc.slug || location);
  const [seo, site, stars, feed, siblings, districts, paths, tags, heading, counts, categories] = await Promise.all([
    getSeoFor("location", category),
    getSite(),
    getStarListings(loc.kind === "city" ? { categorySlug: category, citySlug: location } : filter),
    getFeed(filter, page),
    loc.kind === "city" && loc.stateSlug ? getSiblingCities(loc.stateSlug) : Promise.resolve([]),
    loc.kind === "city" ? getDistricts(loc.slug || location).then((rows) => rows.filter((row) => !isCityAlias(loc.name, row.name || ""))) : Promise.resolve([]),
    getPaths(),
    publicTags(),
    urlHeading(canonicalPath, ""),
    listingCountsByCategoryCity().catch(() => []),
    getCategories().catch(() => []),
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
    indexable: !isThin(feed.total, cat.minListingsIndex ?? 3),
    districts: districts.map((row) => row.name || "").filter(Boolean).slice(0, 3),
    updated: feed.items[0]?.publishedAt ? new Date(feed.items[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : undefined,
  });
  const texts = await textOverrides();
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
  const updated = newest && !isThin(feed.total, cat.minListingsIndex ?? 3)
    ? new Date(newest).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : undefined;

  const layout = await resolveListingLayout({ path: canonicalPath, category: cat.slug || category, vars });

  return (
    <ListingPageView
      layout={layout}
      texts={texts}
      h1={heading || visibleHeading(fillTemplate(seo?.h1 || "", vars), copy.h1)}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={copy.intro || fillTemplate(seo?.intro || "", vars)}
      faqs={copy.faqs}
      popular={tags.slice(0, 6).map((tag) => ({ href: tagPath(paths, cat.slug || category, tag.slug), label: `${cat.name} ${tag.label}` }))}
      footer={fillTemplate(seo?.footer || "", vars)}
      crumbs={[
        { name: t("listing.crumb.home"), path: "/" },
        { name: cat.name!, path: `/${cat.slug}/` },
        ...(loc.stateSlug ? [{ name: `${stateName} ${cat.name}`, path: placePath(cat.slug || category, loc.stateSlug) }] : []),
        { name: `${loc.name} ${cat.name}`, path: canonicalPath },
      ]}
      locationLabel={`${stateName} - ${loc.name}`}
      cityName={loc.name}
      categoryName={cat.name}
      districts={districts.map((d) => ({ href: placePath(cat.slug || category, loc.slug || location, d.slug || ""), label: d.name! }))}
      path={`${canonicalPath}${sp.photos || sp.verified ? `?${new URLSearchParams({ ...(sp.photos ? { photos: "1" } : {}), ...(sp.verified ? { verified: "1" } : {}) }).toString()}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total, cat.minListingsIndex ?? 3) || page > 1 || (filtered && feed.total === 0)}
      updated={updated}
      siblingLinks={siblingLinks}
      emptyNearby={siblings.slice(0, 6).map((c) => ({ href: placePath(cat.slug || category, c.slug || ""), label: c.name! }))}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
