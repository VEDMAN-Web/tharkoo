"use client";

import { useRouter } from "next/navigation";
import type { ListingLabels, PlaceOption, PlaceSelects } from "./listing-filters";

/**
 * H7.4b: the category, state, city and area selects of the filter panel. Choosing an entry goes to its clean SEO
 * URL (the place or the category), so the filter URLs stay out of the place selects. Area is disabled until a city
 * page has areas to choose from.
 */
export function ListingPlaceSelects({ selects, labels }: { selects: PlaceSelects; labels: Pick<ListingLabels, "category" | "state" | "city" | "area"> }) {
  const router = useRouter();
  const go = (options: PlaceOption[], value: string) => {
    const found = options.find((option) => option.value === value);
    if (found) router.push(found.href);
  };
  const field = (
    title: string,
    options: PlaceOption[],
    value: string,
    disabled = false,
  ) => (
    <label className="tkn-ls-select">
      <span className="tkn-ls-select-label">{title}</span>
      <select value={value} disabled={disabled} onChange={(event) => go(options, event.target.value)}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="tkn-ls-places">
      {field(labels.category, selects.categories, selects.categoryValue)}
      {field(labels.state, selects.states, selects.stateValue)}
      <div className="tkn-ls-cityarea">
        {field(labels.city, selects.cities, selects.cityValue)}
        {field(labels.area, selects.areas, selects.areaValue, selects.areas.length === 0)}
      </div>
    </div>
  );
}
