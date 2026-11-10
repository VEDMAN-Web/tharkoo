import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPageView } from "@/components/ListingPage";
import {
  getCategory,
  getCities,
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
import { fallbackLanding } from "@/lib/seo/landing";
import { TAG_PAGES } from "@/data/catalog";

type Props = {
  params: Promise<{ category: string; location: string; district: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
};

export const revalidate = 300;

async function cityFor(slug: string) {
  const loc = await getLocationBySlug(slug);
  if (loc?.kind === "city") return loc;
  const rows = await getCities();
  return rows.find((row) => row.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, location, district } = await params;
  const sp = await searchParams;
  const [cat, city, districtRows, seo, site] = await Promise.all([
    getCategory(category),
    cityFor(location),
    getDistricts(location),
    getSeo("location"),
    getSite(),
  ]);
  const dist = districtRows.find((row) => row.slug === district);
  if (!cat || !city || !dist) return {};
  const vars = {
    category: cat.name,
    city: city.name,
    district: dist.name,
    districtPref: ` / ${dist.name}`,
    site: site.name,
  };
  const copy = fallbackLanding({ category: cat.name || category, city: city.name || location, district: dist.name || district, site: site.name });
  const title = fillTemplate(seo?.title || copy.title, vars);
  const description = fillTemplate(seo?.description || copy.description, vars);
  const pageNo = Math.max(1, Number(sp.page) || 1);
  const filtered = Boolean(sp.photos || sp.verified);
  const feed = await getFeed(
    { categorySlug: category, citySlug: location, districtSlug: district, ...(sp.photos ? { photos: true } : {}), ...(sp.verified ? { verified: true } : {}) },
    pageNo,
  );
  const query = new URLSearchParams();
  if (sp.photos) query.set("photos", "1");
  if (sp.verified) query.set("verified", "1");
  if (pageNo > 1) query.set("page", String(pageNo));
  const suffix = query.toString();
  return pageMetadata({
    title,
    description,
    path: `/${category}/${location}/${district}/${suffix ? `?${suffix}` : ""}`,
    index: pageNo === 1 && !(filtered && feed.total === 0) && !isThin(feed.total),
    follow: true,
  });
}

export default async function DistrictPage({ params, searchParams }: Props) {
  const { category, location, district } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, city, districtRows] = await Promise.all([
    getCategory(category),
    cityFor(location),
    getDistricts(location),
  ]);
  const dist = districtRows.find((row) => row.slug === district);
  if (!cat || !city || !dist) notFound();
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
      h1={fillTemplate(seo?.h1 || "{category} in {district}", vars)}
      faqs={fallbackLanding({ category: cat.name || category, city: city.name || location, district: dist.name || district, count: feed.total, site: site.name }).faqs}
      popular={TAG_PAGES.slice(0, 4).map((tag) => ({ href: `/${category}/tag/${tag.slug}/`, label: `${dist.name} ${tag.label}` }))}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={fallbackLanding({ category: cat.name || category, city: city.name || location, district: dist.name || district, count: feed.total, site: site.name }).intro || fillTemplate(seo?.intro || "", vars)}
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
      noindex={isThin(feed.total) || page > 1 || (Boolean(sp.photos || sp.verified) && feed.total === 0)}
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
