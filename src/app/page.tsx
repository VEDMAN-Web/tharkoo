import Link from "next/link";
import { getCategories, getSeo, getSite, getTopCities } from "@/lib/queries";
import { fillTemplate } from "@/lib/seo";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { CategoryIcon } from "@/components/CategoryIcon";

export default async function Home() {
  const [site, seo, categories, cities] = await Promise.all([
    getSite(),
    getSeo("home"),
    getCategories(),
    getTopCities(),
  ]);
  const vars = { site: site.name || "Tharkoo", year: new Date().getFullYear() };
  const h1 = fillTemplate(seo?.h1 || "Hot meetings in your city", vars);
  const h2 = fillTemplate(seo?.h2 || "", vars);
  const intro = fillTemplate(seo?.intro || "", vars);
  const featured = cities.slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: canonical("/"),
        }}
      />
      <h1 className="text-[28px] font-normal leading-tight text-[#222] md:text-[34px]">{h1}</h1>
      {h2 ? <h2 className="mt-1 text-[18px] font-normal text-[#555]">{h2}</h2> : null}

      <div className="mt-8 grid gap-8">
        {categories.map((cat) => (
          <section key={cat.slug} className="flex gap-4 border-b border-[#ddd] pb-6">
            <CategoryIcon slug={cat.slug!} color={cat.color} name={cat.name!} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-bold">
                <Link href={`/${cat.slug}/`} className="text-[#222] no-underline hover:underline">
                  {cat.name}
                </Link>
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[#666]">{cat.description}</p>
              <ul className="mt-2 text-[13px]">
                {featured.map((city) => (
                  <li key={city.slug}>
                    <Link href={`/${cat.slug}/${city.slug}/`}>
                      {cat.name} {city.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-[13px] leading-6 text-[#555]">{intro}</p>
      {seo?.footer ? <p className="mt-3 text-[13px] leading-6 text-[#555]">{fillTemplate(seo.footer, vars)}</p> : null}
    </>
  );
}
