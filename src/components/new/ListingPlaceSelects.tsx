"use client";

import { useRouter } from "next/navigation";
import { useSiteCountrySlug } from "@/components/SiteCountry";
import type { ListingLabels, PlaceOption, PlaceSelects } from "./listing-filters";

/**
 * H7.4d: the states and cities of the country on show. A list with no place of that country is left whole. The current
 * value always stays, so a visitor on another country's page still sees where they are.
 */
export function scopeToCountry(options: PlaceOption[], site: string, value: string): PlaceOption[] {
  if (!options.some((option) => option.country === site)) return options;
  return options.filter((option) => !option.country || option.country === site || option.value === value);
}

/**
 * H7.4b: the category, state, city and area selects of the filter panel. Choosing an entry goes to its clean SEO
 * URL (the place or the category), so the filter URLs stay out of the place selects. Area shows once a city with
 * areas is chosen. H7.4d: states and cities are scoped to the site country.
 */
export function ListingPlaceSelects({ selects, labels }: { selects: PlaceSelects; labels: Pick<ListingLabels, "category" | "state" | "city" | "area"> }) {
  const router = useRouter();
  const site = useSiteCountrySlug();
  const go = (options: PlaceOption[], value: string) => {
    const found = options.find((option) => option.value === value);
    if (found) router.push(found.href);
  };
  const field = (title: string, options: PlaceOption[], value: string, wide = false) => (
    <div className={wide ? "tkn-ls-select tkn-ls-select-wide" : "tkn-ls-select"}>
      {/* H19.1: autoComplete off, so the browser never fills in a state from an earlier visit: a category opens on All states. */}
      <select aria-label={title} title={title} value={value} autoComplete="off" onChange={(event) => go(options, event.target.value)}>
        {scopeToCountry(options, site, value).map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div className="tkn-ls-places">
      {field(labels.category, selects.categories, selects.categoryValue, true)}
      {field(labels.state, selects.states, selects.stateValue)}
      {field(labels.city, selects.cities, selects.cityValue)}
      {selects.cityValue && selects.areas.length > 0 ? field(labels.area, selects.areas, selects.areaValue, true) : null}
    </div>
  );
}
