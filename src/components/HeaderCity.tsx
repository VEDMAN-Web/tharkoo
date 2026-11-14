"use client";

import { MapPin } from "lucide-react";
import { useCity } from "./CityContext";

type City = { slug: string; name: string; stateSlug?: string };

/** H7.1: the city picker button used in the header (wide screens) and in the drawer (narrow screens). */
export function HeaderCityButton({ expanded, onToggle, className }: { expanded: boolean; onToggle: () => void; className?: string }) {
  const { city } = useCity();
  return (
    <button type="button" className={className ?? "tkn-city"} aria-haspopup="true" aria-expanded={expanded} onClick={onToggle}>
      <MapPin size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
      <span>{city || "All cities"}</span>
    </button>
  );
}

/** H7.1: the list of cities to pick from. Picking one sets the city for the whole site, as the old header does. */
export function HeaderCityList({ cities, onPick }: { cities: City[]; onPick?: () => void }) {
  const { city, setCity } = useCity();
  return (
    <ul className="tkn-citylist" aria-label="Choose a city">
      <li>
        <button type="button" aria-pressed={!city} className="tkn-citylist-row" onClick={() => { setCity(undefined); onPick?.(); }}>
          All cities
        </button>
      </li>
      {cities.map((item) => (
        <li key={item.slug}>
          <button
            type="button"
            aria-pressed={city === item.name}
            className="tkn-citylist-row"
            onClick={() => {
              setCity(item.name, item.slug);
              onPick?.();
            }}
          >
            {item.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
