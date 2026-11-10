import Link from "next/link";
import type { Metadata } from "next";
import { getCategories, getCities, getStates, getSite } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = { title: "Cities of India" };

export default async function CitiesPage() {
  const [states, cities, categories, site] = await Promise.all([getStates(), getCities(), getCategories(), getSite()]);
  const first = categories[0]?.slug || "dating";
  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: site.name || "India", path: "/" },
          { name: "India", path: "/cities/" },
        ]}
        backHref="/"
      />
      <h1 className="listing-h1">Cities of India</h1>
      <h2 className="listing-h2">India</h2>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="cat-hub-state">
            <h2>{state.name}</h2>
            <div className="footer-city-pills" style={{ justifyContent: "flex-start" }}>
              {inState.map((city) => (
                <Link key={city.slug} href={`/${first}/${city.slug}/`} className="no-underline">
                  <span className="button-pill">{city.name}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
