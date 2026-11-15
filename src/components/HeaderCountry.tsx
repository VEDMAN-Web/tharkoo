"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { setSiteCountry } from "@/app/actions/site-country";
import { useDismiss } from "@/components/ui/useDismiss";
import { SITE_COUNTRY_EVENT, useSiteCountry } from "@/components/SiteCountry";
import { CountryFlag } from "@/components/ui/CountryFlag";
import type { CountryOption } from "@/server/locations/country-scope";

/** A country for the menu. `ads` is the live ad count; 0 shows "No ads yet" (the country can still be chosen). */
export type MenuCountry = CountryOption & { ads?: number };

/** How many countries (in admin order) sit under "Popular". */
const POPULAR_COUNT = 7;

function byName(a: MenuCountry, b: MenuCountry) {
  return a.name.localeCompare(b.name);
}

/**
 * H7.4c / P1: the country list. A search box, "Popular" (the first countries in admin order), then every country A to Z.
 * The chosen country has a tick on its row. Picking a country sets the site country cookie and refreshes the page.
 */
export function CountryList({ countries, onPick }: { countries: MenuCountry[]; onPick?: () => void }) {
  const router = useRouter();
  const current = useSiteCountry(countries);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const matches = (country: MenuCountry) => !needle || country.name.toLowerCase().includes(needle);
  const popular = countries.slice(0, POPULAR_COUNT).filter(matches);
  const all = [...countries].sort(byName).filter(matches);

  function pick(slug: string) {
    setError("");
    startTransition(async () => {
      const res = await setSiteCountry(slug);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      window.dispatchEvent(new CustomEvent(SITE_COUNTRY_EVENT));
      onPick?.();
      router.refresh();
    });
  }

  function renderRows(list: MenuCountry[]) {
    return (
      <ul className="tkn-citylist">
        {list.map((country) => {
          const chosen = current?.slug === country.slug;
          return (
            <li key={country.slug}>
              <button type="button" aria-pressed={chosen} className="tkn-citylist-row" disabled={pending} onClick={() => pick(country.slug)}>
                <CountryFlag code={country.code} />
                <span className="tkn-citylist-name">{country.name}</span>
                {chosen ? <Check size={16} aria-hidden="true" focusable="false" className="tkn-citylist-tick" /> : null}
                {!chosen && country.ads === 0 ? <span className="tkn-citylist-none">No ads yet</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="tkn-countrylist-wrap">
      <label className="tkn-country-search">
        <Search size={16} aria-hidden="true" focusable="false" />
        <span className="tkn-sr">Search a country</span>
        <input type="search" placeholder="Search a country" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
      </label>
      {popular.length ? (
        <>
          <p className="tkn-country-group">Popular</p>
          {renderRows(popular)}
        </>
      ) : null}
      <p className="tkn-country-group">All countries A to Z</p>
      {all.length ? renderRows(all) : <p className="tkn-country-empty">No country matches.</p>}
      {error ? <p role="alert" className="tkn-countrylist-error">{error}</p> : null}
    </div>
  );
}

/** H7.4c / P1: the country pill in the header: flag, name and a small down arrow. A click opens the country list. */
export function HeaderCountry({ countries }: { countries: MenuCountry[] }) {
  const current = useSiteCountry(countries);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, wrap, () => setOpen(false));
  return (
    <div className="tkn-city-wrap" ref={wrap}>
      <button type="button" className="tkn-city" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {current ? <CountryFlag code={current.code} /> : <MapPin size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />}
        <span>{current?.name ?? "Country"}</span>
        <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" focusable="false" className="tkn-city-arrow" />
      </button>
      {open ? (
        <div className="tkn-pop tkn-pop-country" role="group" aria-label="Countries">
          <CountryList countries={countries} onPick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
