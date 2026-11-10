"use client";

import { useCity } from "./CityContext";

export function HeroCity() {
  const { city } = useCity();
  const label = city || "All India";
  return (
    <button
      type="button"
      className="inline-flex h-9 max-w-[16rem] items-center rounded-pill border border-[color:var(--gold-line)] px-3 t-small text-gold"
      title={label}
      onClick={() => window.dispatchEvent(new Event("tk-open-city"))}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
