import "./city-page.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { countListings, getCategories, getCityLatest, getDistricts, getHomepageContent, getLocationBySlug, listingCountsByCategoryCity, pageOutOfRange } from "@/lib/queries";
import { isCityAlias } from "@/lib/seo/district-alias";
import { citiesPath, joinPath, placePath, postAdPath, searchPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { withSeoDefaults } from "@/lib/ui/meta-defaults";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { getPaths } from "@/server/urls/service";
import { readShellConfig } from "@/server/site-links/shell-config";
import { textOverrides } from "@/app/admin/ui-text/store";
import { makeT, pickTexts } from "@/lib/ui/text";
import { AdCard, UiTextProvider } from "@/components/ui/AdCard";
import { ListingMore } from "@/components/new/ListingMore";
import { NewListingPage } from "@/components/new/ListingBand";
import { listingLabels } from "@/components/new/listing-frame-props";
import { bandChoice, heroBandFrom } from "@/components/new/band-image";
import { FallbackAds } from "@/components/FallbackAds";
import { FALLBACK_OWN_MINIMUM, loadFallbackSections } from "@/lib/fallback-ads";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }>; searchParams: Promise<{ page?: string }> };

/** The city's areas and categories, and its live ad count. Shared by the metadata and the page. */
async function cityAreas(city: string) {
  const [loc, areas, counts, categories, total] = await Promise.all([
    getLocationBySlug(city),
    getDistricts(city),
    listingCountsByCategoryCity().catch(() => []),
    getCategories().catch(() => []),
    countListings({ citySlug: city }),
  ]);
  if (!loc || loc.kind !== "city") return null;
  const named = areas.filter((area) => area.slug && area.name && !isCityAlias(loc.name || city, area.name));
  const cityCounts = new Map(counts.filter((row) => row._id.citySlug === city && row.n > 0).map((row) => [row._id.categorySlug, row.n]));
  return { name: loc.name || city, stateSlug: loc.stateSlug || "", total, areas: named, categories, cityCounts };
}

function countLabel(n: number) {
  return `${n} ${n === 1 ? "ad" : "ads"}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const paths = await getPaths();
  const data = await cityAreas(city);
  if (!data) return {};
  const path = joinPath(citiesPath(paths), city);
  return withSeoDefaults(
    await withUrlSeo(path, {
      title: `Areas in ${data.name} | Tharkoo`,
      description: `Pick an area of ${data.name} to browse classifieds near you on Tharkoo. Every area lists its own ads and photos.`,
      path,
      // H7.32: a city with no ads of its own stays noindex (fallback ads do not count as its content).
      index: data.areas.length > 0 && data.total > 0,
      follow: true,
    }),
  );
}

export default async function CityAreasPage({ params, searchParams }: Props) {
  const { city } = await params;
  const sp = await searchParams;
  const data = await cityAreas(city);
  if (!data) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const [latest, paths, shell, texts, perArea, hero] = await Promise.all([
    getCityLatest(city, page),
    getPaths(),
    readShellConfig(),
    textOverrides(),
    Promise.all(data.areas.map((area) => countListings({ citySlug: city, districtSlug: area.slug ?? "" }).catch(() => null))),
    getHomepageContent().then(heroBandFrom),
  ]);
  if (pageOutOfRange(sp.page, latest.pages)) notFound();

  const t = makeT(texts);
  const labels = listingLabels(t);
  const hub = citiesPath(paths);
  const crumbs = [
    { name: "Tharkoo India", path: "/" },
    { name: "Cities", path: hub },
    { name: data.name, path: joinPath(hub, city) },
  ];
  // H7.32: the band photo: the city, then the state, then the home hero.
  const band = bandChoice(shell, hero, { city, state: data.stateSlug || undefined });
  const photos = new Map(shell.media.images.filter((image) => image.scope === "category" && image.photo).map((image) => [image.slug, image.photo]));

  // H7.32 (FIX B): few own ads keep their place, and fallback ads go below them. With none, one line and a post button.
  const own = latest.total < FALLBACK_OWN_MINIMUM;
  const fallback = own
    ? await loadFallbackSections({
        scope: { stateSlug: data.stateSlug || undefined, placeName: data.name },
        ownSlugs: latest.items.map((ad) => ad.slug || "").filter(Boolean),
      })
    : [];
  const lead =
    latest.total === 0
      ? { text: `No ads in ${data.name} yet. Here are ads close by.`, button: `Post the first ad in ${data.name}`, href: postAdPath(paths) }
      : undefined;

  return (
    <UiTextProvider texts={pickTexts(texts, "card.")}>
      <NewListingPage
        tk="city-areas"
        band={{
          crumbs,
          h1: data.name,
          intro: `Free classifieds across ${data.name}. Pick a category or an area.`,
          photo: band,
          searchAction: searchPath(paths),
          citySlug: city,
          placeholder: `Search ads in ${data.name}`,
          labels,
        }}
      >
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
          {latest.total > 0 ? (
            <section data-tk="city-latest">
              <h2>Latest ads in {data.name}</h2>
              <div className="tk-feed tkn-city-ads">
                {latest.items.map((ad, index) => (
                  <AdCard key={ad.publicId || ad.slug || index} ad={ad} priority={index === 0} layout="row" />
                ))}
              </div>
              <ListingMore page={latest.page} pages={latest.pages} params={{}} label={t("listing.more")} />
            </section>
          ) : null}
          <FallbackAds sections={fallback} layout="row" lead={lead} />
          <section data-tk="city-categories">
            <h2>Browse {data.name} by category</h2>
            <ul className="tkn-city-cats">
              {data.categories.map((cat) => {
                const slug = cat.slug ?? "";
                const n = data.cityCounts.get(slug) ?? 0;
                const photo = photos.get(slug);
                return (
                  <li key={slug}>
                    <Link className="tkn-city-cat" href={placePath(slug, city)} prefetch={false}>
                      {photo ? (
                        <img className="tkn-city-cat-photo" src={photo} alt="" width={480} height={360} loading="lazy" />
                      ) : (
                        <span className="tkn-city-cat-photo" aria-hidden="true" />
                      )}
                      <span className="tkn-city-cat-body">
                        <span className="tkn-city-cat-name">{cat.name}</span>
                        <span className={n > 0 ? "tkn-city-cat-count" : "tkn-city-cat-count is-new"}>{n > 0 ? countLabel(n) : "New"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <section data-tk="city-areas-list">
            <h2>Areas in {data.name}</h2>
            {data.areas.length === 0 ? (
              <p className="tkn-city-empty">Areas for {data.name} are coming soon. Browse by category above.</p>
            ) : (
              <ul className="tkn-city-areas">
                {data.areas.map((area, index) => {
                  const n = perArea[index];
                  return (
                    <li key={area.slug} className="tkn-city-area">
                      <h3 className="tkn-city-area-name">{area.name}</h3>
                      {n !== null && n !== undefined ? <p className="tkn-city-area-count">{n > 0 ? countLabel(n) : "No ads yet"}</p> : null}
                      <p className="tkn-city-chips">
                        {data.categories.slice(0, 6).map((cat) => (
                          <Link key={cat.slug} href={placePath(cat.slug ?? "", city, area.slug ?? "")} prefetch={false} className="tk-pill">
                            {cat.name}
                          </Link>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
      </NewListingPage>
    </UiTextProvider>
  );
}
