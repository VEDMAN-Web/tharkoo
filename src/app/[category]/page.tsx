import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getCities, getSeo, getSite, getStates } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { TAG_PAGES } from "@/data/catalog";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [cat, seo, site] = await Promise.all([getCategory(category), getSeo("category"), getSite()]);
  if (!cat) return {};
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };
  return {
    title: fillTemplate(seo?.title || "{category} | Tharkoo", vars),
    description: fillTemplate(seo?.description || "", vars),
    alternates: { canonical: canonical(`/${category}/`) },
  };
}

export default async function CategoryHub({ params }: Props) {
  const { category } = await params;
  const cat = await getCategory(category);
  if (!cat) notFound();
  const [seo, site, cities, states] = await Promise.all([
    getSeo("category"),
    getSite(),
    getCities(),
    getStates(),
  ]);
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: "India", path: "/" },
          { name: cat.name!, path: `/${category}/` },
        ]}
        backHref="/"
      />
      <h1 className="listing-h1">{fillTemplate(seo?.h1 || "{category} in India", vars)}</h1>
      <h2 className="listing-h2">{fillTemplate(seo?.h2 || "All cities", vars)}</h2>
      <p className="listing-intro">{fillTemplate(seo?.intro || "", vars)}</p>
      <div className="listing-filters">
        {TAG_PAGES.map((t) => (
          <Link key={t.slug} href={`/${category}/tag/${t.slug}/`} className="listingfilters no-underline">
            {t.label}
          </Link>
        ))}
      </div>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="cat-hub-state">
            <h2>
              <Link href={`/${category}/${state.slug}/`} className="no-underline">
                {state.name}
              </Link>
            </h2>
            <div className="footer-city-pills" style={{ justifyContent: "flex-start" }}>
              {inState.map((city) => (
                <Link key={city.slug} href={`/${category}/${city.slug}/`} className="no-underline">
                  <span className="button-pill">
                    {cat.name} {city.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {seo?.footer ? <p className="listing-footer">{fillTemplate(seo.footer, vars)}</p> : null}
    </>
  );
}
