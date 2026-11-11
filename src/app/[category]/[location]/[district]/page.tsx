import { notFound, permanentRedirect } from "next/navigation";
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
  pageOutOfRange,
} from "@/lib/queries";
import { prettyPlace } from "@/lib/format";
import { fillTemplate } from "@/lib/seo";
import { placePath, tagPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { fallbackLanding, visibleHeading } from "@/lib/seo/landing";
import { getPaths, publicTags } from "@/server/urls/service";

type Props = {
  params: Promise<{ category: string; location: string; district: string }>;
  searchParams: Promise<{ page?: string; photos?: string; verified?: string }>;
};

export const revalidate = 60;

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
  const feedForCopy = await getFeed({ categorySlug: category, citySlug: location, districtSlug: district }, 1);
  const copy = fallbackLanding({
    category: cat.name || category,
    city: city.name || location,
    district: dist.name || district,
    count: feedForCopy.total,
    site: site.name,
  });
  const counted = { ...vars, count: feedForCopy.total };
  const title = fillTemplate(seo?.title || copy.title, counted);
  const rawDescription = fillTemplate(seo?.description || copy.description, counted);
  const description = rawDescription.length <= 160 ? rawDescription : `${rawDescription.slice(0, 157).replace(/\s+\S*$/, "")}`;
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
  const path = placePath(cat.slug || category, city.slug || location, dist.slug || district);
  return withUrlSeo(path, {
    title,
    description,
    path: `${path}${suffix ? `?${suffix}` : ""}`,
    index: pageNo === 1 && !(filtered && feed.total === 0) && !isThin(feed.total, cat.minListingsLocality ?? 10),
    follow: true,
  });
}

export default async function DistrictPage({ params, searchParams }: Props) {
  const { category, location, district } = await params;
  const sp = await searchParams;
  if (sp.page !== undefined && !/^[1-9]\d*$/.test(sp.page)) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const [cat, city, districtRows] = await Promise.all([
    getCategory(category),
    cityFor(location),
    getDistricts(location),
  ]);
  const dist = districtRows.find((row) => row.slug === district);
  if (!cat || !city || !dist) notFound();
  if (cat.slug !== category || city.slug !== location || dist.slug !== district) {
    permanentRedirect(placePath(cat.slug || category, city.slug || location, dist.slug || district));
  }
  const canonicalPath = placePath(cat.slug || category, city.slug || location, dist.slug || district);
  const filter: Record<string, unknown> = { categorySlug: category, citySlug: location, districtSlug: district };
  if (sp.photos) Object.assign(filter, { photos: { $exists: true, $ne: [] } });
  if (sp.verified) Object.assign(filter, { verified: true });
  const [seo, site, stars, feed, districts, paths, tags, heading] = await Promise.all([
    getSeo("location"),
    getSite(),
    getStarListings(filter),
    getFeed(filter, page),
    getDistricts(city.slug || location),
    getPaths(),
    publicTags(),
    urlHeading(canonicalPath, ""),
  ]);
  if (pageOutOfRange(sp.page, feed.pages)) notFound();
  const thin = isThin(feed.total, cat.minListingsLocality ?? 10);
  const districtCopy = fallbackLanding({
    category: cat.name || category,
    city: city.name || location,
    district: dist.name || district,
    count: feed.total,
    site: site.name,
    indexable: !thin,
    updated: feed.items[0]?.publishedAt
      ? new Date(feed.items[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : undefined,
  });
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
      h1={heading || visibleHeading(fillTemplate(seo?.h1 || "", vars), districtCopy.h1)}
      faqs={districtCopy.faqs}
      popular={tags.slice(0, 4).map((tag) => ({ href: tagPath(paths, cat.slug || category, tag.slug), label: `${dist.name} ${tag.label}` }))}
      h2={fillTemplate(seo?.h2 || "", vars)}
      intro={districtCopy.intro || fillTemplate(seo?.intro || "", vars)}
      crumbs={[
        { name: "Tharkoo India", path: "/" },
        { name: cat.name!, path: `/${cat.slug}/` },
        { name: `${prettyPlace(city.stateSlug)} ${cat.name}`, path: placePath(cat.slug || category, city.stateSlug || "") },
        { name: `${city.name} ${cat.name}`, path: placePath(cat.slug || category, city.slug || location) },
        { name: `${dist.name} ${cat.name}`, path: canonicalPath },
      ]}
      locationLabel={`${prettyPlace(city.stateSlug)} - ${city.name}`}
      cityName={city.name}
      categoryName={cat.name}
      districts={districts.map((d) => ({ href: placePath(cat.slug || category, city.slug || location, d.slug || ""), label: d.name! }))}
      path={`${canonicalPath}${sp.photos || sp.verified ? `?${new URLSearchParams({ ...(sp.photos ? { photos: "1" } : {}), ...(sp.verified ? { verified: "1" } : {}) }).toString()}` : ""}`}
      stars={stars}
      items={feed.items}
      page={feed.page}
      pages={feed.pages}
      total={feed.total}
      noindex={thin || page > 1 || (Boolean(sp.photos || sp.verified) && feed.total === 0)}
      updated={
        !thin && feed.items[0]?.publishedAt
          ? new Date(feed.items[0].publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
          : undefined
      }
      siblingLinks={districts
        .filter((row) => row.slug !== dist.slug)
        .slice(0, 4)
        .map((row) => ({
          href: placePath(cat.slug || category, city.slug || location, row.slug || ""),
          label: `${cat.name} in ${row.name}, ${city.name}`,
        }))
        .concat([{ href: placePath(cat.slug || category, city.slug || location), label: `${cat.name} in ${city.name}` }])
        .slice(0, 5)}
      emptyNearby={[{ href: placePath(cat.slug || category, city.slug || location), label: city.name! }]}
      photos={sp.photos === "1"}
      verified={sp.verified === "1"}
    />
  );
}
