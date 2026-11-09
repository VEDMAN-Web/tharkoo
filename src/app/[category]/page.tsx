import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategory, getCities, getSeo, getSite, getStates } from "@/lib/queries";
import { canonical, fillTemplate } from "@/lib/seo";
import { TAG_PAGES } from "@/data/catalog";
import { CategoryIcon } from "@/components/CategoryIcon";

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
      <nav className="mb-2 text-[12px] text-[#888]">
        <Link href="/">India</Link> › {cat.name}
      </nav>
      <div className="flex items-center gap-3">
        <CategoryIcon slug={cat.slug!} color={cat.color} name={cat.name!} />
        <div>
          <h1 className="text-[28px] font-normal">{fillTemplate(seo?.h1 || "{category} in India", vars)}</h1>
          <h2 className="text-[16px] text-[#555]">{fillTemplate(seo?.h2 || "All cities", vars)}</h2>
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#555]">{fillTemplate(seo?.intro || "", vars)}</p>
      <p className="mt-3 text-[13px]">
        Popular:{" "}
        {TAG_PAGES.map((t) => (
          <Link key={t.slug} href={`/${category}/tag/${t.slug}/`} className="mr-3">
            {t.label}
          </Link>
        ))}
      </p>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="mt-8">
            <h2 className="text-[18px] font-bold">
              <Link href={`/${category}/${state.slug}/`} className="text-[#222] no-underline hover:underline">
                {state.name}
              </Link>
            </h2>
            <ul className="mt-2 columns-2 gap-4 text-[13px] md:columns-3">
              {inState.map((city) => (
                <li key={city.slug} className="break-inside-avoid py-0.5">
                  <Link href={`/${category}/${city.slug}/`}>
                    {cat.name} {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {seo?.footer ? <p className="mt-8 text-[13px] text-[#555]">{fillTemplate(seo.footer, vars)}</p> : null}
    </>
  );
}
