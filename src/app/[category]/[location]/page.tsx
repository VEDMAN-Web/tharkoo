import { notFound } from "next/navigation";
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
import { canonical, fillTemplate } from "@/lib/seo";

type Props = {
  params: Promise<{ category: string; location: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, location } = await params;
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
  return {
    title: fillTemplate(seo?.title || "{category} in {city} | Tharkoo", vars),
    description: fillTemplate(seo?.description || "", vars),
    alternates: { canonical: canonical(`/${category}/${location}/`) },
    robots: isThin(feed.total) ? { index: false, follow: true } : undefined,
  };
}

export default async function LocationPage({ params, searchParams }: Props) {
  const { category, location } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, loc] = await Promise.all([getCategory(category), getLocationBySlug(location)]);
  if (!cat || !loc || (loc.kind !== "city" && loc.kind !== "state")) notFound();

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

  const vars = {
    category: cat.name,
    city: loc.name,
    state: loc.name,
    count: feed.total,
    site: site.name,
    year: new Date().getFullYear(),
    districtPref: "",
  };
  const siblingLinks = [
    ...siblings
      .filter((c) => c.slug !== location)
      .slice(0, 20)
      .map((c) => ({ href: `/${category}/${c.slug}/`, label: c.name! })),
    ...districts.map((d) => ({ href: `/${category}/${location}/${d.slug}/`, label: d.name! })),
  ];

  return (
    <ListingPageView
      h1={fillTemplate(seo?.h1 || "{category} in {city}", vars)}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={fillTemplate(seo?.intro || "", vars)}
      footer={fillTemplate(seo?.footer || "", vars)}
      crumbs={[
        { name: "India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
        { name: loc.name!, path: `/${category}/${location}/` },
      ]}
      path={`/${category}/${location}/`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total)}
      siblingLinks={siblingLinks}
      emptyNearby={siblings.slice(0, 6).map((c) => ({ href: `/${category}/${c.slug}/`, label: c.name! }))}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
