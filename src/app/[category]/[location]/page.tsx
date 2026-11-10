import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import {
  getCategory,
  getDistricts,
  getFeed,
  getLocationBySlug,
  getSeo,
  getSiblingCities,
  getSite,
  getStarListings,
  isThin,
} from "@/lib/queries";
import { prettyPlace } from "@/lib/format";
import { fillTemplate } from "@/lib/seo";
import { pageMetadata } from "@/lib/ui/meta";
import { fallbackLanding, mergeLanding, type LandingCopy } from "@/lib/seo/landing";
import { TAG_PAGES } from "@/data/catalog";

type Props = {
  params: Promise<{ category: string; location: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
};

export const revalidate = 300;

function landingFor(site: { name?: string; landings?: Record<string, Partial<LandingCopy>> }, category: string, city: string, count: number) {
  const fallback = fallbackLanding({ category, city, count, site: site.name });
  return mergeLanding(fallback, site.landings?.[`${category.toLowerCase()}|${city.toLowerCase()}`]);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, location } = await params;
  const sp = await searchParams;
  const [cat, loc, seo, site] = await Promise.all([
    getCategory(category),
    getLocationBySlug(location),
    getSeo("location"),
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
  const copy = landingFor(site as { name?: string; landings?: Record<string, Partial<LandingCopy>> }, cat.name || category, loc.name || location, feed.total);
  const title = fillTemplate(seo?.title || copy.title, vars);
  const description = fillTemplate(seo?.description || copy.description, vars);
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const filtered = Boolean(sp.photos || sp.verified);
  const thin = isThin(feed.total);
  const query = new URLSearchParams();
  if (sp.photos) query.set("photos", "1");
  if (sp.verified) query.set("verified", "1");
  if (pageNo > 1) query.set("page", String(pageNo));
  const suffix = query.toString();
  return pageMetadata({
    title,
    description,
    path: `/${category}/${loc.slug}/${suffix ? `?${suffix}` : ""}`,
    index: !thin && pageNo === 1 && !(filtered && feed.total === 0),
    follow: true,
  });
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { category, location } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, loc] = await Promise.all([getCategory(category), getLocationBySlug(location)]);
  if (!cat || !loc || (loc.kind !== "city" && loc.kind !== "state")) notFound();
  if (loc.slug && loc.slug !== location) permanentRedirect(`/${category}/${loc.slug}/`);

  const filter =
    loc.kind === "state"
      ? { categorySlug: category, stateSlug: location }
      : { categorySlug: category, citySlug: location };
  if (sp.photos) Object.assign(filter, { photos: { $exists: true, $ne: [] } });
  if (sp.verified) Object.assign(filter, { verified: true });

  const [seo, site, stars, feed, siblings, districts] = await Promise.all([
    getSeo("location"),
    getSite(),
    getStarListings(loc.kind === "city" ? { categorySlug: category, citySlug: location } : filter),
    getFeed(filter, page),
    loc.kind === "city" && loc.stateSlug ? getSiblingCities(loc.stateSlug) : Promise.resolve([]),
    loc.kind === "city" ? getDistricts(location) : Promise.resolve([]),
  ]);

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
  const copy = landingFor(site as { name?: string; landings?: Record<string, Partial<LandingCopy>> }, cat.name || category, loc.name || location, feed.total);
  const filtered = Boolean(sp.photos || sp.verified);
  const siblingLinks = [
    ...siblings
      .filter((c) => c.slug !== location)
      .slice(0, 20)
      .map((c) => ({ href: `/${category}/${c.slug}/`, label: c.name! })),
    ...districts.map((d) => ({ href: `/${category}/${location}/${d.slug}/`, label: d.name! })),
  ];

  return (
    <ListingPageView
      h1={fillTemplate(seo?.h1 || copy.h1, vars)}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={copy.intro || fillTemplate(seo?.intro || "", vars)}
      faqs={copy.faqs}
      popular={TAG_PAGES.slice(0, 6).map((tag) => ({ href: `/${category}/tag/${tag.slug}/`, label: `${cat.name} ${tag.label}` }))}
      footer={fillTemplate(seo?.footer || "", vars)}
      crumbs={[
        { name: "Tharkoo India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
        ...(loc.stateSlug ? [{ name: `${stateName} ${cat.name}`, path: `/${category}/${loc.stateSlug}/` }] : []),
        { name: `${loc.name} ${cat.name}`, path: `/${category}/${location}/` },
      ]}
      locationLabel={`${stateName} - ${loc.name}`}
      cityName={loc.name}
      categoryName={cat.name}
      districts={districts.map((d) => ({ href: `/${category}/${location}/${d.slug}/`, label: d.name! }))}
      path={`/${category}/${location}/${sp.photos || sp.verified ? `?${new URLSearchParams({ ...(sp.photos ? { photos: "1" } : {}), ...(sp.verified ? { verified: "1" } : {}) }).toString()}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total) || page > 1 || (filtered && feed.total === 0)}
      siblingLinks={siblingLinks}
      emptyNearby={siblings.slice(0, 6).map((c) => ({ href: `/${category}/${c.slug}/`, label: c.name! }))}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
