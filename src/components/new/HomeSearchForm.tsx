"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSiteCountry } from "@/components/SiteCountry";
import type { UrlPaths } from "@/lib/urls";
import type { CountryPlaces } from "@/server/locations/site-country";
import { heroSearchHref } from "./hero-search-href";

type Option = { slug: string; name: string };

/**
 * H7.4c: the hero search under the banner. Three selects and the Search button, nothing else: All states (of the chosen
 * country), All cities (of the chosen state), All categories. Search goes to the clean SEO address (see hero-search-href).
 */
export function HomeSearchForm({
  paths,
  labels,
  countries,
  categories,
}: {
  paths: UrlPaths;
  labels: { state: string; city: string; category: string; allStates: string; allCities: string; allCategories: string; button: string };
  countries: CountryPlaces[];
  categories: Option[];
}) {
  const router = useRouter();
  const country = useSiteCountry(countries);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const states = country?.states ?? [];
  const cities = (country?.cities ?? []).filter((item) => !state || item.stateSlug === state);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(heroSearchHref(paths, { category, state, city }));
  }

  return (
    <form role="search" className="tkh-search m-enter m-enter-2" onSubmit={onSubmit}>
      <label className="tkh-field tkh-field-select">
        <span className="tkh-sr">{labels.state}</span>
        <select name="state" value={state} onChange={(event) => { setState(event.target.value); setCity(""); }}>
          <option value="">{labels.allStates}</option>
          {states.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="tkh-field tkh-field-select">
        <span className="tkh-sr">{labels.city}</span>
        <select name="city" value={city} onChange={(event) => setCity(event.target.value)}>
          <option value="">{labels.allCities}</option>
          {cities.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="tkh-field tkh-field-select">
        <span className="tkh-sr">{labels.category}</span>
        <select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">{labels.allCategories}</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="tkh-go">{labels.button}</button>
    </form>
  );
}
