import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getDistricts, getLocationBySlug, listingCountsByCategoryCity } from "@/lib/queries";
import { isCityAlias } from "@/lib/seo/district-alias";
import { citiesPath, joinPath, placePath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }> };

/** Most categories linked under each area. The area pages themselves carry the listings. */
const CATEGORIES_PER_AREA = 8;

async function cityAreas(city: string) {
  const [loc, areas, counts, categories] = await Promise.all([
    getLocationBySlug(city),
    getDistricts(city),
    listingCountsByCategoryCity().catch(() => []),
    getCategories().catch(() => []),
  ]);
  if (!loc || loc.kind !== "city") return null;
  const live = new Set(counts.filter((row) => row._id.citySlug === city && row.n > 0).map((row) => row._id.categorySlug));
  const liveCategories = categories.filter((cat) => cat.slug && live.has(cat.slug)).slice(0, CATEGORIES_PER_AREA);
  const named = areas.filter((area) => area.slug && area.name && !isCityAlias(loc.name || city, area.name));
  return { name: loc.name || city, areas: named, categories: liveCategories };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const paths = await getPaths();
  const data = await cityAreas(city);
  if (!data) return {};
  const path = joinPath(citiesPath(paths), city);
  return withSeoDefaults(
    await withUrlSeo(path, {
      title: `Areas in ${data.name} | Tharkoo`,
      description: `Pick an area of ${data.name} to browse classifieds near you on Tharkoo. Every area lists its own ads and photos.`,
      path,
      index: data.areas.length > 0,
      follow: true,
    }),
  );
}

export default async function CityAreasPage({ params }: Props) {
  const { city } = await params;
  const data = await cityAreas(city);
  if (!data) notFound();
  const paths = await getPaths();
  const hub = citiesPath(paths);
  return (
    <div className="tk-container" style={{ paddingTop: 16, paddingBottom: 24 }} data-tk="city-areas">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Tharkoo India", path: "/" },
          { name: "Cities", path: hub },
          { name: data.name, path: joinPath(hub, city) },
        ])}
      />
      <Breadcrumbs
        crumbs={[
          { name: "Tharkoo India", path: "/" },
          { name: "Cities", path: hub },
          { name: data.name, path: joinPath(hub, city) },
        ]}
      />
      <h1>Areas in {data.name}</h1>
      {data.areas.length === 0 ? <p>No areas are listed for {data.name} yet.</p> : null}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
        {data.areas.map((area) => (
          <li key={area.slug}>
            <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>{area.name}</h2>
            <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.categories.map((cat) => (
                <Link key={cat.slug} href={placePath(cat.slug!, city, area.slug!)} prefetch={false} className="tk-pill">
                  {cat.name}
                </Link>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
