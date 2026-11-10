import Link from "next/link";
import { getCategories, getCities, getStates } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Cities across India | Tharkoo",
  description: "Browse Tharkoo classifieds by city.",
  path: "/cities/",
});

export default async function CitiesPage() {
  const [states, cities, categories] = await Promise.all([getStates(), getCities(), getCategories()]);
  const first = categories[0]?.slug || "jobs";
  return (
    <Container className="py-6">
      <Breadcrumbs crumbs={[{ name: "India", path: "/" }, { name: "Cities", path: "/cities/" }]} />
      <h1 className="t-h1">Cities across India</h1>
      <p className="t-lead mt-3 text-muted">Pick a city to open its listings.</p>
      {states.map((state) => {
        const inState = cities.filter((c) => c.stateSlug === state.slug);
        if (!inState.length) return null;
        return (
          <section key={state.slug} className="mt-8">
            <h2 className="t-h2">{state.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {inState.map((city) => (
                <Link key={city.slug} href={`/${first}/${city.slug}/`} prefetch={false} className="inline-flex h-9 items-center rounded-pill border border-line px-3 t-small">
                  {city.name}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </Container>
  );
}
