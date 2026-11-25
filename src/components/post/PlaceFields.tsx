"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/help/UiTextProvider";
import { SelectField } from "./FormFields";

export type PostPlace = { id: string; name: string; slug: string; stateSlug?: string };
type Named = { id: string; name: string };

const titleOf = (slug: string) => slug.split("-").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** The states that have at least one city, by name. */
export function statesOf(cities: readonly PostPlace[]): { slug: string; name: string }[] {
  const slugs = [...new Set(cities.map((city) => city.stateSlug).filter((slug): slug is string => Boolean(slug)))];
  return slugs.map((slug) => ({ slug, name: titleOf(slug) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Only the cities of one state, and, when something was typed, only those that contain it (starting with it first). */
export function citiesFor(cities: readonly PostPlace[], stateSlug: string, typed: string): PostPlace[] {
  const inState = stateSlug ? cities.filter((city) => city.stateSlug === stateSlug) : [];
  const needle = typed.trim().toLowerCase();
  if (!needle) return [...inState];
  const starts = inState.filter((city) => city.name.toLowerCase().startsWith(needle));
  const inside = inState.filter((city) => !city.name.toLowerCase().startsWith(needle) && city.name.toLowerCase().includes(needle));
  return [...starts, ...inside];
}

/**
 * H19.6: where the ad is. State first, then the city of that state with a search box over its list, then the area, which can be
 * skipped. Choosing a state clears the city and the area; choosing a city clears the area.
 */
export function PlaceFields({
  cities,
  stateSlug,
  cityId,
  districtId,
  districts,
  error,
  onBlur,
  onState,
  onCity,
  onDistrict,
}: {
  cities: readonly PostPlace[];
  stateSlug: string;
  cityId: string;
  districtId: string;
  districts: readonly Named[];
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onState: (slug: string) => void;
  onCity: (id: string) => void;
  onDistrict: (id: string) => void;
}) {
  const t = useT();
  const cityError = error("city");
  const [typed, setTyped] = useState("");
  const states = useMemo(() => statesOf(cities), [cities]);
  const shown = useMemo(() => citiesFor(cities, stateSlug, typed), [cities, stateSlug, typed]);
  const chosen = cities.find((city) => city.id === cityId);
  // The chosen city stays in the list even when the search no longer matches it.
  const options = chosen && !shown.some((city) => city.id === chosen.id) && chosen.stateSlug === stateSlug ? [chosen, ...shown] : shown;
  return (
    <div className="tkp-place" data-tk="place-fields">
      <SelectField id="state" label={t("post.field.state")} required value={stateSlug} error={error("state")} onBlur={onBlur("state")} onChange={(value) => { setTyped(""); onState(value); }}>
        <option value="">{t("post.select.state")}</option>
        {states.map((state) => (
          <option key={state.slug} value={state.slug}>{state.name}</option>
        ))}
      </SelectField>
      <div className={`tk-field tkp-city ${cityError ? "is-bad" : ""}`}>
        <label htmlFor="city">{t("post.field.city")} *</label>
        <input
          id="city-search"
          className="tkp-city-search"
          type="search"
          value={typed}
          disabled={!stateSlug}
          autoComplete="off"
          aria-label={t("post.select.citySearch")}
          placeholder={stateSlug ? t("post.select.citySearch") : t("post.select.pickStateFirst")}
          onChange={(event) => setTyped(event.target.value)}
        />
        <select id="city" value={cityId} disabled={!stateSlug} onBlur={onBlur("city")} onChange={(event) => onCity(event.target.value)}>
          <option value="">{stateSlug ? (options.length ? t("post.select.city") : t("post.select.cityNone")) : t("post.select.pickStateFirst")}</option>
          {options.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
        {cityError ? <span className="tk-error" data-tk="field-error">{cityError}</span> : null}
      </div>
      <SelectField id="district" label={t("post.field.areaShort")} value={districtId} disabled={!cityId} error={error("district")} onChange={onDistrict}>
        <option value="">{cityId ? t("post.select.area") : t("post.select.pickCityFirst")}</option>
        {districts.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </SelectField>
    </div>
  );
}
