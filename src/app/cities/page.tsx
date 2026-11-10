import Link from "next/link";
import { MapPin } from "lucide-react";
import { getCategories, getCities, getDistricts, getStates } from "@/lib/queries";
import { citiesPath, placePath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(citiesPath(paths), {
    title: "Cities across India | Tharkoo",
    description: "Browse Tharkoo classifieds by city.",
    path: citiesPath(paths),
  });
}

export default async function CitiesPage() {
  const [states, cities, categories] = await Promise.all([getStates(), getCities(), getCategories()]);
  const first = categories[0]?.slug || "dating";
  const top = cities.filter((city) => city.isTop).slice(0, 10);
  const districtLists = await Promise.all(top.map(async (city) => ({ slug: city.slug, rows: await getDistricts(city.slug!) })));
  const districts = new Map(districtLists.map((item) => [item.slug, item.rows]));
  return (
    <>
      <div className="tk-banner" data-tk="cities-banner">
        <div className="tk-container">
          <h1>Tharkoo India</h1>
        </div>
        <MapPin className="tk-banner-pins tk-icon-lg" size={180} color="#fff" aria-hidden />
      </div>
      <div className="tk-container" style={{ paddingBottom: 32 }}>
        <div className="tk-panel">
          <div className="tk-panel-head">🇮🇳 INDIA</div>
          {states.map((state) => {
            const inState = cities.filter((city) => city.stateSlug === state.slug);
            return (
              <div key={state.slug}>
                <Link href={placePath(first, state.slug || "")} className="tk-dir-state" prefetch={false}>
                  {state.name}
                </Link>
                {inState.map((city) => (
                  <div key={city.slug}>
                    <Link href={placePath(first, city.slug || "")} className="tk-dir-city" prefetch={false}>
                      {city.name}
                    </Link>
                    {(districts.get(city.slug!) || []).map((district) => (
                      <Link key={district.slug} href={placePath(first, city.slug || "", district.slug || "")} className="tk-dir-dist" prefetch={false}>
                        {district.name}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
