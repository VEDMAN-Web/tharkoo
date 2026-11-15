import { getCategories, getCities, getStates, listingCountsByCategoryCity } from "@/lib/queries";
import { citiesPath, joinPath, placePath, searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { hubCopy } from "@/lib/seo-site";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { JsonLd } from "@/lib/jsonld";
import { faqPage } from "@/lib/seo/schema";
import { getPaths } from "@/server/urls/service";
import { readShellConfig } from "@/server/site-links/shell-config";
import { photoOf } from "@/components/h714/photo";
import { CitiesView, type CityCard, type StateCard, type StateLetter } from "@/components/h714/CitiesView";

export const revalidate = 300;

const TOP_CITY_COUNT = 8;
const BAND_CHIP_COUNT = 6;
const STATE_CITY_LINKS = 4;

export async function generateMetadata() {
  const paths = await getPaths();
  return withSeoDefaults(
    await withUrlSeo(citiesPath(paths), {
      title: "Cities across India: browse classifieds by city | Tharkoo",
      description: "Pick your city to browse free classifieds across India. See ads, photos and how to contact each poster.",
      path: citiesPath(paths),
    }),
  );
}

export default async function CitiesPage() {
  const paths = await getPaths();
  const [states, cities, categories, counts, hub, shell] = await Promise.all([
    getStates(),
    getCities(),
    getCategories().catch(() => []),
    listingCountsByCategoryCity().catch(() => []),
    hubCopy(citiesPath(paths), { intro: "", faqs: [] }),
    readShellConfig(),
  ]);
  const first = categories[0]?.slug || "dating";
  const cityHref = (slug?: string) => joinPath(citiesPath(paths), slug || "");

  const adsByCity = new Map<string, number>();
  for (const row of counts) {
    adsByCity.set(row._id.citySlug, (adsByCity.get(row._id.citySlug) ?? 0) + row.n);
  }
  const stateName = new Map(states.map((state) => [state.slug, state.name || ""]));
  const cityCard = (city: (typeof cities)[number]): CityCard => {
    const ads = (adsByCity.get(city.slug || "") ?? 0).toLocaleString("en-IN");
    const area = stateName.get(city.stateSlug || "") || "";
    return { slug: city.slug || "", name: city.name || "", summary: [area, `${ads} ads`].filter(Boolean).join(" · "), href: cityHref(city.slug), photo: photoOf(shell, "city", city.slug || "") };
  };

  const topRows = cities.filter((city) => city.isTop);
  const topCities = (topRows.length ? topRows : cities).slice(0, TOP_CITY_COUNT).map(cityCard);
  const bandChips = topCities.slice(0, BAND_CHIP_COUNT);

  const stateCards: StateCard[] = states.map((state) => {
    const inState = cities.filter((city) => city.stateSlug === state.slug);
    const total = inState.reduce((sum, city) => sum + (adsByCity.get(city.slug || "") ?? 0), 0);
    return {
      slug: state.slug || "",
      name: state.name || "",
      anchor: `state-${state.slug || ""}`,
      adsLabel: `${total.toLocaleString("en-IN")} ads`,
      allLabel: inState.length === 1 ? "1 city" : `All ${inState.length} cities`,
      href: placePath(first, state.slug || ""),
      cities: inState.slice(0, STATE_CITY_LINKS).map((city) => ({ slug: city.slug || "", name: city.name || "", summary: "", href: cityHref(city.slug), photo: "" })),
    };
  });

  const seenLetters = new Set<string>();
  const stateLetters: StateLetter[] = [];
  for (const state of states) {
    const letter = (state.name || "").charAt(0).toUpperCase();
    if (!letter || seenLetters.has(letter)) continue;
    seenLetters.add(letter);
    stateLetters.push({ letter, href: `#state-${state.slug || ""}` });
  }

  const bandIntro = cities.length
    ? `Choose your city to see ads near you. ${cities.length.toLocaleString("en-IN")} cities and areas.`
    : "Choose your city to see ads near you.";

  return (
    <>
      {hub.faqs.length ? <JsonLd data={[faqPage(hub.faqs)]} /> : null}
      <CitiesView
        bandIntro={bandIntro}
        bandChips={bandChips}
        topCities={topCities}
        states={stateCards}
        stateLetters={stateLetters}
        searchHref={searchPath(paths)}
      >
        {hub.intro || hub.faqs.length ? (
          <div className="tk-container" style={{ paddingBottom: 32 }}>
            {hub.intro ? <p className="tk-seo-foot">{hub.intro}</p> : null}
            {hub.faqs.map((item) => (
              <p key={item.q} className="tk-seo-foot">
                <strong>{item.q}</strong> {item.a}
              </p>
            ))}
          </div>
        ) : null}
      </CitiesView>
    </>
  );
}
