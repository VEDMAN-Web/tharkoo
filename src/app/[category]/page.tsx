import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getCategory, getCities, getFeed, getSeo, getSite, getStates, listingCountsByCategoryCity } from "@/lib/queries";
import { getPaths } from "@/server/urls/service";
import { adPath, categoryPath, placePath } from "@/lib/urls";
import { fillTemplate } from "@/lib/seo";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { faqPage, itemListNode } from "@/lib/seo/schema";
import { canonical } from "@/lib/seo";
import { fallbackLanding, mergeLanding, type LandingCopy } from "@/lib/seo/landing";

type Props = { params: Promise<{ category: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeo("category"), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const title = fillTemplate(seo?.title || "{category} ads in India | Tharkoo", vars);
  const description = fillTemplate(seo?.description || `Browse ${cat.name} listings across Indian cities.`, vars);
  const path = categoryPath(cat.slug || category);
  return withUrlSeo(path, { title, description, path });
}

export default async function CategoryHub({ params }: Props) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  if (cat.slug && cat.slug !== category) permanentRedirect(categoryPath(cat.slug));
  const [seo, site, cities, states, counts, feed, paths, heading] = await Promise.all([
    getSeo("category"),
    getSite(),
    getCities(),
    getStates(),
    listingCountsByCategoryCity().catch(() => []),
    getFeed({ categorySlug: category }, 1),
    getPaths(),
    urlHeading(categoryPath(cat.slug || category), `${cat.name} in India`),
  ]);
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  const copy = mergeLanding(
    fallbackLanding({ category: cat.name || category, count: feed.total, site: site.name }),
    (site as { landings?: Record<string, Partial<LandingCopy>> }).landings?.[`${category}|india`],
  );
  const allowed = new Set(counts.filter((row) => row._id.categorySlug === category && row.n > 0).map((row) => row._id.citySlug));
  const listed = allowed.size ? cities.filter((city) => allowed.has(city.slug || "")) : cities;
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Tharkoo India", path: "/" },
            { name: cat.name || category, path: categoryPath(cat.slug || category) },
          ]),
          itemListNode({
            url: canonical(categoryPath(cat.slug || category)),
            total: feed.total,
            items: feed.items.slice(0, 12).map((ad, index) => ({
              url: canonical(adPath(paths, ad.slug || "")),
              name: ad.title || "Ad",
              position: index + 1,
            })),
          }),
          faqPage(copy.faqs),
        ]}
      />
      <div className="tk-banner">
        <div className="tk-container">
          <h1>{heading}</h1>
        </div>
        <MapPin className="tk-banner-pins tk-icon-lg" size={180} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
          <Breadcrumbs crumbs={[{ name: "Tharkoo India", path: "/" }, { name: cat.name!, path: categoryPath(cat.slug || category) }]} />
        <div className="tk-panel">
          <div className="tk-panel-head">🇮🇳 INDIA</div>
          {states.map((state) => {
            const inState = listed.filter((city) => city.stateSlug === state.slug);
            if (!inState.length) return null;
            return (
              <div key={state.slug}>
                <Link href={placePath(cat.slug || category, state.slug || "")} className="tk-dir-state" prefetch={false}>
                  {state.name}
                </Link>
                {inState.map((city) => (
                  <Link key={city.slug} href={placePath(cat.slug || category, city.slug || "")} className="tk-dir-city" prefetch={false}>
                    {city.name}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        <p className="tk-seo-foot">{copy.intro || fillTemplate(seo?.intro || "", vars)}</p>
        {copy.faqs.map((item) => (
          <p key={item.q} className="tk-seo-foot">
            <strong>{item.q}</strong> {item.a}
          </p>
        ))}
      </div>
    </>
  );
}
