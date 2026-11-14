import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import { getCategories } from "@/lib/queries";
import { countryPath, placePath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { loadCountryPage } from "@/server/locations/countries";

export const revalidate = 300;

type Props = { params: Promise<{ country: string }> };

export async function generateMetadata({ params }: Props) {
  const { country: slug } = await params;
  const place = await loadCountryPage(slug);
  if (!place) return {};
  const path = countryPath(place.slug);
  return withUrlSeo(path, {
    title: `${place.name} classifieds: browse by state and city | Tharkoo`,
    description: `Browse free classifieds across ${place.name}, by state and city, with the number of live ads in each place.`,
    path,
  });
}

export default async function CountryPage({ params }: Props) {
  const { country: slug } = await params;
  const [place, categories] = await Promise.all([loadCountryPage(slug), getCategories()]);
  if (!place) notFound();
  const first = categories[0]?.slug || "dating";
  const hasPlaces = place.states.length > 0 || place.cities.length > 0;
  return (
    <>
      <div className="tk-banner" data-tk="country-banner">
        <div className="tk-container">
          <h1>
            <span aria-hidden>{place.flag || "🌐"}</span> {place.name}
          </h1>
        </div>
        <Globe className="tk-banner-pins tk-icon-lg" size={116} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
        <p>
          <Link href="/countries/" prefetch={false}>All countries</Link>
        </p>
        {hasPlaces ? null : <p>No places yet.</p>}
        {place.states.map((state) => (
          <div className="tk-panel" key={state.slug} data-tk="country-state">
            <div className="tk-panel-head">
              {state.name} ({state.count})
            </div>
            <Link href={placePath(first, state.slug)} className="tk-dir-state" prefetch={false}>
              {state.name}
            </Link>
            {state.cities.map((city) => (
              <Link key={city.slug} href={placePath(first, city.slug)} className="tk-dir-city" prefetch={false}>
                {city.name} ({city.count})
              </Link>
            ))}
          </div>
        ))}
        {place.cities.length > 0 ? (
          <div className="tk-panel" data-tk="country-cities">
            <div className="tk-panel-head">Other places ({place.cities.length})</div>
            {place.cities.map((city) => (
              <Link key={city.slug} href={placePath(first, city.slug)} className="tk-dir-city" prefetch={false}>
                {city.name} ({city.count})
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
