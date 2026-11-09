import Link from "next/link";
import type { Metadata } from "next";
import { getCategories, getCities, getStates } from "@/lib/queries";

export const metadata: Metadata = { title: "All cities" };

export default async function CitiesPage() {
  const [states, cities, categories] = await Promise.all([getStates(), getCities(), getCategories()]);
  const first = categories[0]?.slug || "local-services";
  return (
    <>
      <h1 className="text-3xl font-semibold">All cities</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Grouped by state. Opens the first category on each city page.</p>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="mt-6">
            <h2 className="text-lg font-semibold">{state.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {inState.map((city) => (
                <Link key={city.slug} href={`/${first}/${city.slug}/`} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-gray-200">
                  {city.name}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
