import type { ReactNode } from "react";
import type { BandPhoto } from "./band-image";
import { categoryPath, placePath } from "@/lib/urls";
import type { TextFn } from "@/lib/ui/text";
import { bandStyleFor } from "./band-image";
import { ListingHead } from "./ListingHead";
import { ListingSearchForm } from "./ListingSearchForm";
import { ListingFilterPanel, type KeywordProps } from "./ListingFilterPanel";
import {
  activeFilterCount,
  panelRows,
  type AttributePicks,
  type FilterField,
  type ListingLabels,
  type ListingToggles,
  type PlaceOption,
  type PlaceSelects,
} from "./listing-filters";

/** The visible words of the band and the panel, read from the UI-text store (keys "listing.band.*", "listing.panel.*"). */
export function listingLabels(t: TextFn): ListingLabels {
  return {
    keyword: t("listing.band.keyword"),
    search: t("listing.band.search"),
    filters: t("listing.band.filters"),
    all: t("listing.band.all"),
    close: t("listing.band.close"),
    breadcrumb: t("listing.band.breadcrumb"),
    panelTitle: t("listing.panel.title"),
    activeTemplate: t("listing.panel.active"),
    filtersLabel: t("listing.panel.filtersLabel"),
    category: t("listing.panel.category"),
    state: t("listing.panel.state"),
    city: t("listing.panel.city"),
    area: t("listing.panel.area"),
    allStates: t("listing.panel.allStates"),
    allCities: t("listing.panel.allCities"),
    allAreas: t("listing.panel.allAreas"),
    pickCity: t("listing.panel.pickCity"),
    clear: t("listing.panel.clear"),
    apply: t("listing.panel.apply"),
    show: t("listing.panel.show"),
    showOne: t("listing.panel.showOne"),
    noFilters: t("listing.panel.noFilters"),
    verified: t("listing.filters.verified"),
    photos: t("listing.filters.photos"),
    video: t("listing.filters.video"),
    online: t("listing.filters.online"),
    min: t("listing.filters.min"),
    max: t("listing.filters.max"),
  };
}

/**
 * The place selects. Each entry links to the clean SEO URL: a category, a state, a city or an area. The category
 * keeps the current place when it changes, so a visitor on a city stays on that city.
 */
export function placeSelects(input: {
  categorySlug: string;
  categories: { slug?: string | null; name?: string | null }[];
  states: { slug?: string | null; name?: string | null; countrySlug?: string | null }[];
  cities: { slug?: string | null; name?: string | null; countrySlug?: string | null }[];
  districts: { slug?: string | null; name?: string | null }[];
  stateSlug?: string;
  citySlug?: string;
  districtSlug?: string;
  labels: ListingLabels;
}): PlaceSelects {
  const cat = input.categorySlug;
  const place = input.citySlug || input.stateSlug || "";
  const named = <T extends { slug?: string | null; name?: string | null; countrySlug?: string | null }>(
    rows: T[],
    href: (slug: string) => string,
  ): PlaceOption[] =>
    rows
      .filter((row): row is T & { slug: string } => Boolean(row.slug))
      .map((row) => ({ value: row.slug, label: row.name || row.slug, href: href(row.slug), country: row.countrySlug || undefined }));
  return {
    categories: named(input.categories, (slug) => (place ? placePath(slug, place) : categoryPath(slug))),
    categoryValue: cat,
    states: [{ value: "", label: input.labels.allStates, href: categoryPath(cat) }, ...named(input.states, (slug) => placePath(cat, slug))],
    stateValue: input.stateSlug || "",
    cities: [
      { value: "", label: input.labels.allCities, href: input.stateSlug ? placePath(cat, input.stateSlug) : categoryPath(cat) },
      ...named(input.cities, (slug) => placePath(cat, slug)),
    ],
    cityValue: input.citySlug || "",
    areas: input.citySlug
      ? [
          { value: "", label: input.labels.allAreas, href: placePath(cat, input.citySlug) },
          ...named(input.districts, (slug) => placePath(cat, input.citySlug as string, slug)),
        ]
      : [],
    areaValue: input.districtSlug || "",
  };
}

export function searchPlaceSelects(input: {
  searchPath: string;
  params: Record<string, string>;
  categories: { slug?: string | null; name?: string | null }[];
  states: { slug?: string | null; name?: string | null; countrySlug?: string | null }[];
  cities: { slug?: string | null; name?: string | null; countrySlug?: string | null; stateSlug?: string | null }[];
  districts: { slug?: string | null; name?: string | null }[];
  labels: ListingLabels;
}): PlaceSelects {
  const hrefFor = (change: Record<string, string>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...input.params, ...change })) {
      if (key !== "page" && value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${input.searchPath}?${text}` : input.searchPath;
  };
  const options = <T extends { slug?: string | null; name?: string | null; countrySlug?: string | null }>(rows: T[], key: string, reset: Record<string, string> = {}): PlaceOption[] =>
    rows
      .filter((row): row is T & { slug: string } => Boolean(row.slug))
      .map((row) => ({ value: row.slug, label: row.name || row.slug, href: hrefFor({ [key]: row.slug, ...reset }), country: row.countrySlug || undefined }));
  const stateSlug = input.params.state || "";
  const citySlug = input.params.city || "";
  const cities = stateSlug ? input.cities.filter((city) => !city.stateSlug || city.stateSlug === stateSlug) : input.cities;
  return {
    categories: [{ value: "", label: input.labels.all, href: hrefFor({ category: "" }) }, ...options(input.categories, "category")],
    categoryValue: input.params.category || "",
    states: [{ value: "", label: input.labels.allStates, href: hrefFor({ state: "", city: "", area: "" }) }, ...options(input.states, "state", { city: "", area: "" })],
    stateValue: stateSlug,
    cities: [{ value: "", label: input.labels.allCities, href: hrefFor({ city: "", area: "" }) }, ...options(cities, "city", { area: "" })],
    cityValue: citySlug,
    areas: citySlug ? [{ value: "", label: input.labels.allAreas, href: hrefFor({ area: "" }) }, ...options(input.districts, "area")] : [],
    areaValue: input.params.area || "",
  };
}

/**
 * Builds the parts of the listing frame (title band, search form, filter panel) for a category or city page.
 * The city page and the category page share it. Server-side only: it returns elements.
 */
export function listingFrameProps(input: {
  crumbs: { name: string; path: string }[];
  h1: string;
  intro?: string;
  photo: BandPhoto | null;
  categorySlug: string;
  citySlug?: string;
  searchAction: string;
  searchPlaceholder: string;
  chips: ReactNode;
  fields: FilterField[] | undefined;
  picks: AttributePicks;
  toggles: ListingToggles;
  /** The listing URL without filters: the panel posts here and "Clear all" goes here. */
  panelPath: string;
  labels: ListingLabels;
  places: PlaceSelects;
  panelHidden?: { name: string; value: string }[];
  placesOnly?: boolean;
  keyword?: KeywordProps;
  total?: number;
  activeCount?: number;
}) {
  const rows = panelRows(input.fields, input.picks);
  const activeCount = input.activeCount ?? activeFilterCount(rows, input.toggles);
  return {
    bandStyle: bandStyleFor(input.photo),
    head: <ListingHead crumbs={input.crumbs} h1={input.h1} intro={input.intro} labels={input.labels} />,
    chips: input.chips,
    searchForm: (
      <ListingSearchForm
        action={input.searchAction}
        categorySlug={input.categorySlug}
        citySlug={input.citySlug}
        placeholder={input.searchPlaceholder}
        labels={input.labels}
      />
    ),
    filters: (
      <ListingFilterPanel
        action={input.panelPath}
        clearHref={input.panelPath}
        rows={rows}
        activeCount={activeCount}
        toggles={input.toggles}
        labels={input.labels}
        places={input.places}
        hidden={input.panelHidden}
        placesOnly={input.placesOnly}
        keyword={input.keyword}
        total={input.total}
      />
    ),
    activeCount,
  };
}

export function introCategory(name: string | null | undefined): string {
  return (name || "").toLowerCase().replace(/\s+ads?$/, "");
}
