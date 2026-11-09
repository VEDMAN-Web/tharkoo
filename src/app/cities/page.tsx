import Link from "next/link";
import type { Metadata } from "next";
import { getCategories, getCities, getStates, getSite } from "@/lib/queries";

export const metadata: Metadata = { title: "Cities of India" };

export default async function CitiesPage() {
  const [states, cities, categories, site] = await Promise.all([getStates(), getCities(), getCategories(), getSite()]);
  const first = categories[0]?.slug || "call-girls";
  return (
    <>
      <nav className="mb-2 text-[12px] text-[#888]">
        <Link href="/">{site.name}</Link> › India
      </nav>
      <h1 className="text-[28px] font-normal text-[#222]">Cities of India</h1>
      <h2 className="mt-1 text-[16px] font-normal text-[#555]">India</h2>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="mt-6">
            <h3 className="text-[16px] font-bold text-[#222]">{state.name}</h3>
            <ul className="mt-1 columns-2 text-[14px] leading-7 md:columns-3">
              {inState.map((city) => (
                <li key={city.slug} className="break-inside-avoid">
                  <Link href={`/${first}/${city.slug}/`}>{city.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
