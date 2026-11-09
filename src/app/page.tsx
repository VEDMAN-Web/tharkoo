import Link from "next/link";
import { getCategories, getSeo, getSite, getStarListings, getTopCities } from "@/lib/queries";
import { fillTemplate } from "@/lib/seo";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { StarStrip } from "@/components/AdCard";

export default async function Home() {
  const [site, seo, categories, cities, stars] = await Promise.all([
    getSite(),
    getSeo("home"),
    getCategories(),
    getTopCities(),
    getStarListings({}, 6),
  ]);
  const vars = { site: site.name || "Tharkoo", year: new Date().getFullYear() };
  const h1 = fillTemplate(seo?.h1 || "Listings in your city", vars);
  const h2 = fillTemplate(seo?.h2 || "", vars);
  const intro = fillTemplate(seo?.intro || "", vars);

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
      <h1 className="text-3xl font-semibold md:text-4xl">{h1}</h1>
      {h2 ? <h2 className="mt-2 text-lg text-[var(--text-secondary)]">{h2}</h2> : null}
      <p className="mt-4 max-w-3xl text-sm leading-6">{intro}</p>
      <StarStrip ads={stars} />
      <div className="mt-8 grid gap-6">
        {categories.map((cat) => (
          <section key={cat.slug} className="rounded-[var(--radius)] border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  <Link href={`/${cat.slug}/`}>{cat.name}</Link>
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{cat.description}</p>
              </div>
              <Link href={`/${cat.slug}/`} className="text-sm underline">
                All cities
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cities.slice(0, 3).map((city) => (
                <Link
                  key={city.slug}
                  href={`/${cat.slug}/${city.slug}/`}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm"
                >
                  {cat.name} {city.name}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-8 rounded-[var(--radius)] bg-[var(--brand-primary)] p-6 text-white">
        <h2 className="text-xl font-semibold">Boost your visibility</h2>
        <p className="mt-2 text-sm text-white/80">
          Post for free, then use Top, Flash or Star so buyers see you in the hours they browse.
        </p>
        <Link
          href="/u/post-insert"
          className="mt-4 inline-block rounded bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white hover:text-white"
        >
          Post your ad
        </Link>
      </section>
    </>
  );
}
