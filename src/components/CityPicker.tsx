"use client";

import { useMemo, useState } from "react";
import { useCity } from "./CityContext";
import { Dialog } from "./ui/Dialog";

type City = { slug: string; name: string; stateSlug?: string };

export function CityPicker({
  cities,
  onClose,
}: {
  brand?: string;
  cities: City[];
  category?: string;
  onClose: () => void;
}) {
  const { setCity, citySlug } = useCity();
  const [q, setQ] = useState("");
  const popular = cities.slice(0, 8);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, City[]>();
    cities
      .filter((city) => !needle || city.name.toLowerCase().includes(needle))
      .forEach((city) => {
        const key = city.stateSlug || "Other";
        map.set(key, [...(map.get(key) || []), city]);
      });
    return [...map.entries()];
  }, [cities, q]);

  function choose(city: City) {
    setCity(city.name, city.slug);
    onClose();
  }

  return (
    <Dialog open title="Choose a city" onClose={onClose} sheet>
      <h2 className="t-h2">Choose a city</h2>
      <input
        autoFocus
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search city"
        aria-label="Search city"
        className="mt-3 h-12 w-full rounded-md border border-line bg-surface px-3 text-base"
      />
      <p className="t-overline mb-2 mt-4">Popular</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-pill border border-line px-3 py-2 t-small" onClick={() => { setCity(); onClose(); }}>
          All India
        </button>
        {popular.map((city) => (
          <button key={city.slug} type="button" className="rounded-pill border border-line px-3 py-2 t-small" onClick={() => choose(city)}>
            {city.name}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4">
        {groups.map(([state, rows]) => (
          <div key={state}>
            <h3 className="t-h3 mb-2">{state}</h3>
            <ul className="grid grid-cols-2 gap-1">
              {rows.map((city) => (
                <li key={city.slug}>
                  <button type="button" className={`min-h-11 w-full text-left t-small ${city.slug === citySlug ? "text-gold" : ""}`} onClick={() => choose(city)}>
                    {city.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!groups.length ? <p className="t-small text-muted">No match</p> : null}
      </div>
    </Dialog>
  );
}
