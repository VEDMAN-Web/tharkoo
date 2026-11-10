import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getCities, getSeo, getSite, getStates } from "@/lib/queries";
import { fillTemplate } from "@/lib/seo";
import { pageMetadata } from "@/lib/ui/meta";
import { TAG_PAGES } from "@/data/catalog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Container } from "@/components/ui/Container";

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
  const [seo, site, cities, states] = await Promise.all([getSeo("category"), getSite(), getCities(), getStates()]);
  const vars = { category: cat.name, site: site.name, year: new Date().getFullYear() };

  return (
    <Container className="py-6">
      <Breadcrumbs crumbs={[{ name: "India", path: "/" }, { name: cat.name!, path: `/${category}/` }]} />
      <h1 className="t-h1">{fillTemplate(seo?.h1 || "{category} in India", vars)}</h1>
      <p className="t-lead mt-3 max-w-[68ch] text-muted">{fillTemplate(seo?.intro || "", vars)}</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {TAG_PAGES.map((t) => (
          <Link key={t.slug} href={`/${category}/tag/${t.slug}/`} prefetch={false} className="inline-flex h-9 shrink-0 items-center rounded-pill border border-line px-3 t-small">
            {t.label}
          </Link>
        ))}
      </div>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="mt-8">
            <h2 className="t-h2">
              <Link href={`/${category}/${state.slug}/`} prefetch={false}>
                {state.name}
              </Link>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {inState.map((city) => (
                <Link key={city.slug} href={`/${category}/${city.slug}/`} prefetch={false} className="inline-flex h-9 items-center rounded-pill border border-line px-3 t-small">
                  {city.name}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {seo?.footer ? <p className="t-small mt-8 max-w-[68ch] text-muted">{fillTemplate(seo.footer, vars)}</p> : null}
    </Container>
  );
}
