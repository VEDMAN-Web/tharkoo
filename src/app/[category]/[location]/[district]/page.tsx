import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import {
  getCategory,
  getDistricts,
  getFeed,
  getLocationBySlug,
  getSeo,
  getSite,
  getStarListings,
  isThin,
} from "@/lib/queries";
import { prettyPlace } from "@/lib/format";
import { fillTemplate } from "@/lib/seo";
import { pageMetadata } from "@/lib/ui/meta";

type Props = {
  params: Promise<{ category: string; location: string; district: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, location, district } = await params;
  const [cat, city, dist, seo, site] = await Promise.all([
    getCategory(category),
    getLocationBySlug(location),
    getLocationBySlug(district),
    getSeo("location"),
    getSite(),
  ]);
  if (!cat || !city || !dist) return {};
  const vars = {
    category: cat.name,
    city: city.name,
    district: dist.name,
    districtPref: ` / ${dist.name}`,
    site: site.name,
  };
  const title = fillTemplate(seo?.title || "{category} in {city}{districtPref} | Tharkoo", vars);
  const description = `${cat.name} listings in ${dist.name}, ${city.name}.`;
  return pageMetadata({ title, description, path: `/${category}/${location}/${district}/` });
}

export default async function DistrictPage({ params, searchParams }: Props) {
  const { category, location, district } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, city, dist] = await Promise.all([
    getCategory(category),
    getLocationBySlug(location),
    getLocationBySlug(district),
  ]);
  if (!cat || city?.kind !== "city" || dist?.kind !== "district") notFound();
  const filter: Record<string, unknown> = { categorySlug: category, citySlug: location, districtSlug: district };
  if (sp.photos) Object.assign(filter, { photos: { $exists: true, $ne: [] } });
  if (sp.verified) Object.assign(filter, { verified: true });
  const [seo, site, stars, feed, districts] = await Promise.all([
    getSeo("location"),
    getSite(),
    getStarListings(filter),
    getFeed(filter, page),
    getDistricts(location),
  ]);
  const vars = {
    category: cat.name,
    city: city.name,
    district: dist.name,
    districtPref: ` / ${dist.name}`,
    site: site.name,
    count: feed.total,
    year: new Date().getFullYear(),
  };
  return (
    <ListingPageView
      h1={fillTemplate(seo?.h1 || "{category} in {city}{districtPref}", vars)}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={fillTemplate(seo?.intro || "", vars)}
      crumbs={[
        { name: "Tharkoo India", path: "/" },
        { name: cat.name!, path: `/${category}/` },
        { name: `${prettyPlace(city.stateSlug)} ${cat.name}`, path: `/${category}/${city.stateSlug}/` },
        { name: `${city.name} ${cat.name}`, path: `/${category}/${location}/` },
        { name: `${dist.name} ${cat.name}`, path: `/${category}/${location}/${district}/` },
      ]}
      locationLabel={`${prettyPlace(city.stateSlug)} - ${city.name}`}
      cityName={city.name}
      categoryName={cat.name}
      districts={districts.map((d) => ({ href: `/${category}/${location}/${d.slug}/`, label: d.name! }))}
      path={`/${category}/${location}/${district}/${sp.photos || sp.verified ? `?${new URLSearchParams({ ...(sp.photos ? { photos: "1" } : {}), ...(sp.verified ? { verified: "1" } : {}) }).toString()}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={isThin(feed.total)}
      siblingLinks={districts.map((d) => ({
        href: `/${category}/${location}/${d.slug}/`,
        label: d.name!,
      }))}
      emptyNearby={[{ href: `/${category}/${location}/`, label: city.name! }]}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
