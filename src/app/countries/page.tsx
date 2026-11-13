import Link from "next/link";
import { Globe } from "lucide-react";
import { getCategories } from "@/lib/queries";
import { placePath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { loadCountryDirectory } from "@/server/locations/countries";

export const revalidate = 300;

const PATH = "/countries/";

export async function generateMetadata() {
  return withUrlSeo(PATH, {
    title: "All countries: browse classifieds by country | Tharkoo",
    description: "Every country and city on Tharkoo with the number of live ads. Pick a place to browse free classifieds.",
    path: PATH,
  });
}

export default async function CountriesPage() {
  const [countries, categories] = await Promise.all([loadCountryDirectory(), getCategories()]);
  const first = categories[0]?.slug || "dating";
  return (
    <>
      <div className="tk-banner" data-tk="countries-banner">
        <div className="tk-container">
          <h1>All countries</h1>
        </div>
        <Globe className="tk-banner-pins tk-icon-lg" size={116} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
        {countries.length === 0 ? <p>No countries yet.</p> : null}
        {countries.map((country) => (
          <div className="tk-panel" key={country.slug}>
            <div className="tk-panel-head">
              <span aria-hidden>{country.flag || "🌐"}</span> {country.name} ({country.count})
            </div>
            <Link href={placePath(first, country.slug)} className="tk-dir-state" prefetch={false}>
              {country.name}
            </Link>
            {country.cities.map((city) => (
              <Link key={city.slug} href={placePath(first, city.slug)} className="tk-dir-city" prefetch={false}>
                {city.name} ({city.count})
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
