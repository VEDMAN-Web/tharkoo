"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin } from "lucide-react";
import { setSiteCountry } from "@/app/actions/site-country";
import { useDismiss } from "@/components/ui/useDismiss";
import { SITE_COUNTRY_EVENT, useSiteCountry } from "@/components/SiteCountry";
import { CountryFlag } from "@/components/ui/CountryFlag";
import type { CountryOption } from "@/server/locations/country-scope";

/**
 * H7.4c: the list of countries (flag and name, the current one ticked). Picking one sets the site country cookie and
 * refreshes the page, so every place list then shows that country's places.
 */
export function CountryList({ countries, onPick }: { countries: CountryOption[]; onPick?: () => void }) {
  const router = useRouter();
  const current = useSiteCountry(countries);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="tkn-countrylist-wrap">
      <ul className="tkn-citylist" aria-label="Choose a country">
        {countries.map((country) => {
          const chosen = current?.slug === country.slug;
          return (
            <li key={country.slug}>
              <button type="button" aria-pressed={chosen} className="tkn-citylist-row" disabled={pending} onClick={() => pick(country.slug)}>
                <CountryFlag code={country.code} /> <span>{country.name}</span>
                {chosen ? <Check size={16} aria-hidden="true" focusable="false" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert" className="tkn-countrylist-error">{error}</p> : null}
    </div>
  );
}

/** H7.4c: the country pill in the header. Shows the flag and name of the site country; a click opens the country list. */
export function HeaderCountry({ countries }: { countries: CountryOption[] }) {
  const current = useSiteCountry(countries);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, wrap, () => setOpen(false));
  return (
    <div className="tkn-city-wrap" ref={wrap}>
      <button type="button" className="tkn-city" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {current ? <CountryFlag code={current.code} /> : <MapPin size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />}
        <span>{current?.name ?? "Country"}</span>
      </button>
      {open ? (
        <div className="tkn-pop" role="group" aria-label="Countries">
          <CountryList countries={countries} onPick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
