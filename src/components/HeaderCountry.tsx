"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { setSiteCountry } from "@/app/actions/site-country";
import { useDismiss } from "@/components/ui/useDismiss";
import { SITE_COUNTRY_EVENT, useChosenCountry, useSiteCountrySlug } from "@/components/SiteCountry";
import { ISO_COUNTRIES, flagSrc } from "@/lib/countries";
import type { CountryOption } from "@/server/locations/country-scope";

/** A country the admin has enabled, with its live ad count (0 shows "No ads yet"). */
export type MenuCountry = CountryOption & { ads?: number };

/** One row of the menu: an enabled country (Popular) or any other ISO country (All countries A to Z). */
type Row = { slug: string; name: string; code: string; ads: number; enabled: boolean };

/** H7.10: India leads the Popular list; the rest keep the admin order. */
const LEAD_CODE = "IN";

function popularRows(countries: MenuCountry[]): Row[] {
  const rows = countries.map((country) => ({
    slug: country.slug,
    name: country.name,
    code: country.code,
    ads: country.ads ?? 0,
    enabled: true,
  }));
  return rows.sort((a, b) => Number(b.code === LEAD_CODE) - Number(a.code === LEAD_CODE));
}

/** Every ISO country except the enabled ones (they are in Popular). ISO_COUNTRIES is sorted A to Z already. */
function allRows(countries: MenuCountry[]): Row[] {
  const enabled = new Set(countries.map((country) => country.code.toUpperCase()).filter(Boolean));
  return ISO_COUNTRIES.filter((country) => !enabled.has(country.code)).map((country) => ({
    slug: country.slug,
    name: country.name,
    code: country.code,
    ads: 0,
    enabled: false,
  }));
}

/**
 * H7.4c / H7.10: the country list. A search box, "Popular" (the countries the admin enabled, India first), then
 * "All countries A to Z" (every other country). The chosen country has a tick. A country with no ads shows "No ads yet".
 * Picking a country sets the site country cookie. An enabled country refreshes the page; any other goes to the home page.
 */
export function CountryList({ countries, onPick }: { countries: MenuCountry[]; onPick?: () => void }) {
  const router = useRouter();
  const selected = useSiteCountrySlug();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const matches = (row: Row) => !needle || row.name.toLowerCase().includes(needle);
  const popular = popularRows(countries).filter(matches);
  const all = allRows(countries).filter(matches);

  function pick(row: Row) {
    setError("");
    startTransition(async () => {
      const res = await setSiteCountry(row.slug);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      window.dispatchEvent(new CustomEvent(SITE_COUNTRY_EVENT));
      onPick?.();
      if (row.enabled) router.refresh();
      else router.push("/");
    });
  }

  function renderRows(list: Row[]) {
    return (
      <ul className="tkn-citylist">
        {list.map((row) => {
          const chosen = selected === row.slug;
          return (
            <li key={row.slug}>
              <button type="button" aria-pressed={chosen} className="tkn-citylist-row" disabled={pending} onClick={() => pick(row)}>
                {/* The flag is an SVG file, loaded only when its row is on screen (lazy). */}
                <img className="tkn-flag" src={flagSrc(row.code)} alt="" width={16} height={12} loading="lazy" decoding="async" />
                <span className="tkn-citylist-name">{row.name}</span>
                {chosen ? <Check size={16} aria-hidden="true" focusable="false" className="tkn-citylist-tick" /> : null}
                {!chosen && row.ads === 0 ? <span className="tkn-citylist-none">No ads yet</span> : null}
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

/** H7.4c / H7.10: the country pill in the header: flag, name and a small down arrow. A click opens the country list. */
export function HeaderCountry({ countries }: { countries: MenuCountry[] }) {
  const current = useChosenCountry(countries);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, wrap, () => setOpen(false));
  return (
    <div className="tkn-city-wrap" ref={wrap}>
      <button type="button" className="tkn-city" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {current.code ? (
          <img className="tkn-flag" src={flagSrc(current.code)} alt="" width={16} height={12} decoding="async" />
        ) : (
          <MapPin size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        )}
        <span>{current.name}</span>
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
