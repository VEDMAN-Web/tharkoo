import "./countries-page.css";
import Link from "next/link";
import { getCategories, getHomepageContent } from "@/lib/queries";
import { countryPath, placePath, searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { loadCountryDirectory } from "@/server/locations/countries";
import { getPaths } from "@/server/urls/service";
import { readShellConfig } from "@/server/site-links/shell-config";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT } from "@/lib/ui/text";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { NewListingPage } from "@/components/new/ListingBand";
import { listingLabels } from "@/components/new/listing-frame-props";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";

export const revalidate = 300;

const PATH = "/countries/";

export async function generateMetadata() {
  return withSeoDefaults(
    await withUrlSeo(PATH, {
      title: "All countries: browse classifieds by country | Tharkoo",
      description: "Every country and city on Tharkoo with the number of live ads. Pick a place to browse classifieds.",
      path: PATH,
    }),
  );
}

function adsLabel(count: number) {
  return `${count.toLocaleString("en-IN")} ${count === 1 ? "ad" : "ads"}`;
}

export default async function CountriesPage() {
  const [countries, categories, paths, shell, hero, texts] = await Promise.all([
    loadCountryDirectory(),
    getCategories().catch(() => []),
    getPaths(),
    readShellConfig(),
    getHomepageContent().then(heroBandFrom),
    textOverrides(),
  ]);
  const t = makeT(texts);
  const first = categories[0]?.slug || "dating";
  const ordered = [...countries].sort((a, b) => Number(b.slug === "india") - Number(a.slug === "india"));
  const crumbs = [
    { name: t("listing.crumb.home"), path: "/" },
    { name: "Countries", path: PATH },
  ];
  return (
    <NewListingPage
      tk="countries"
      band={{
        crumbs,
        h1: "All countries",
        intro: "Pick a country to browse classifieds. Every country lists its cities with the number of live ads.",
        photo: bandChoice(shell, hero, {}),
        searchAction: searchPath(paths),
        placeholder: "Search ads",
        labels: listingLabels(t),
      }}
    >
      {ordered.length === 0 ? <p className="tkn-co-empty">No countries yet.</p> : null}
      <ul className="tkn-co-grid">
        {ordered.map((country) => (
          <li key={country.slug} className="tkn-co-card" data-tk="country-card" data-wide={country.cities.length > 8 ? "true" : "false"}>
            <div className="tkn-co-head">
              <CountryFlag code={country.code} />
              <h2 className="tkn-co-name">
                <Link href={countryPath(country.slug)} prefetch={false}>
                  {country.name}
                </Link>
              </h2>
              <span className="tkn-co-count">{adsLabel(country.count)}</span>
            </div>
            <div className="tk-pills tk-pills-left">
              {country.cities.map((city) => (
                <Link key={city.slug} href={placePath(first, city.slug)} className="tk-pill" prefetch={false}>
                  {city.name} ({city.count})
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </NewListingPage>
  );
}
