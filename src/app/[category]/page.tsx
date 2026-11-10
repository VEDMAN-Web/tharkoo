import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getCategory, getCities, getSeo, getSite, getStates, listingCountsByCategoryCity } from "@/lib/queries";
import { fillTemplate } from "@/lib/seo";
import { pageMetadata } from "@/lib/ui/meta";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeo("category"), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const title = fillTemplate(seo?.title || "{category} ads in India | Tharkoo", vars);
  const description = fillTemplate(seo?.description || `Browse ${cat.name} listings across Indian cities.`, vars);
  return pageMetadata({ title, description, path: `/${category}/` });
}

export default async function CategoryHub({ params }: Props) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  const [seo, site, cities, states, counts] = await Promise.all([
    getSeo("category"),
    getSite(),
    getCities(),
    getStates(),
    listingCountsByCategoryCity().catch(() => []),
  ]);
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const allowed = new Set(counts.filter((row) => row._id.categorySlug === category && row.n > 0).map((row) => row._id.citySlug));
  const listed = allowed.size ? cities.filter((city) => allowed.has(city.slug || "")) : cities;
  return (
    <>
      <div className="tk-banner">
        <div className="tk-container">
          <h1>{cat.name} in India</h1>
        </div>
        <MapPin className="tk-banner-pins tk-icon-lg" size={180} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
        <Breadcrumbs crumbs={[{ name: "Tharkoo India", path: "/" }, { name: cat.name!, path: `/${category}/` }]} />
        <div className="tk-panel">
          <div className="tk-panel-head">🇮🇳 INDIA</div>
          {states.map((state) => {
            const inState = listed.filter((city) => city.stateSlug === state.slug);
            if (!inState.length) return null;
            return (
              <div key={state.slug}>
                <Link href={`/${category}/${state.slug}/`} className="tk-dir-state" prefetch={false}>
                  {state.name}
                </Link>
                {inState.map((city) => (
                  <Link key={city.slug} href={`/${category}/${city.slug}/`} className="tk-dir-city" prefetch={false}>
                    {city.name}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        <p className="tk-seo-foot">{fillTemplate(seo?.intro || "", vars)}</p>
      </div>
    </>
  );
}
