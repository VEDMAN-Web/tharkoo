"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";

/** H21.2: one City box over the cities of every state. Typing filters it (names that start with the letters first); choosing a city sets its state too. */

export type ComboCity = { id: string; name: string; stateSlug?: string };

const MAX_OPTIONS = 8;
const titleOf = (slug: string) => slug.split("-").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** The cities that match what was typed: names that start with it first, then names that contain it. At most `limit`. */
export function matchCities(cities: readonly ComboCity[], typed: string, limit = MAX_OPTIONS): ComboCity[] {
  const needle = typed.trim().toLowerCase();
  if (!needle) return [];
  const starts: ComboCity[] = [];
  const inside: ComboCity[] = [];
  for (const city of cities) {
    const name = city.name.toLowerCase();
    if (name.startsWith(needle)) starts.push(city);
    else if (name.includes(needle)) inside.push(city);
  }
  return [...starts, ...inside].slice(0, limit);
}

type Props = {
  cities: readonly ComboCity[];
  cityId: string;
  /** The message to show under the box (from the page's checks), if any. */
  error?: string;
  onPick: (city: ComboCity | null) => void;
  onBlur?: () => void;
};

export function CityCombobox({ cities, cityId, error, onPick, onBlur }: Props) {
  const t = useT();
  const listId = useId();
  const chosen = cities.find((city) => city.id === cityId) ?? null;
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const text = typed ?? chosen?.name ?? "";
  const options = useMemo(() => matchCities(cities, text), [cities, text]);
  const listOpen = open && !chosen && options.length > 0;
  // Text that matches no city names itself in the message; otherwise the page's own message (empty city) is shown.
  const noMatch = typed !== null && typed.trim() !== "" && !chosen && !open;
  const message = noMatch ? t("post.v2.det.errCityNone", { typed: typed.trim() }) : error || "";

  function pick(city: ComboCity) {
    setTyped(null);
    setOpen(false);
    onPick(city);
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && listOpen) {
      // Enter chooses the highlighted city; it never moves on to the next step.
      event.preventDefault();
      event.stopPropagation();
      pick(options[Math.min(active, options.length - 1)]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="tkd-fld" data-tk="city-combobox">
      <label className="tkd-lbl" htmlFor="city">
        <span>{t("post.v2.det.cityLabel")} <span className="tkd-req" aria-hidden="true">*</span></span>
      </label>
      <div className="tkd-combo">
        <Search className="tkd-combo-ico" size={18} aria-hidden="true" focusable="false" />
        <input
          id="city"
          className={`tkd-inp tkd-combo-inp${message ? " err" : ""}${listOpen ? " on" : ""}`}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={message ? true : undefined}
          aria-activedescendant={listOpen ? `${listId}-${Math.min(active, options.length - 1)}` : undefined}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setTyped(event.target.value);
            setOpen(true);
            setActive(0);
            if (chosen) onPick(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            onBlur?.();
          }}
          onKeyDown={onKey}
        />
      </div>
      {listOpen ? (
        <ul id={listId} className="tkd-list" role="listbox" aria-label={t("post.v2.det.cityList")}>
          {options.map((city, index) => {
            const length = text.trim().length;
            const starts = city.name.toLowerCase().startsWith(text.trim().toLowerCase());
            return (
              <li
                key={city.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === Math.min(active, options.length - 1)}
                className={`tkd-opt${index === Math.min(active, options.length - 1) ? " hi" : ""}`}
                // The box loses focus on a press; the choice is made before that happens.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(city);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span>{starts ? <><b>{city.name.slice(0, length)}</b>{city.name.slice(length)}</> : city.name}</span>
                {city.stateSlug ? <small>{titleOf(city.stateSlug)}</small> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {message ? <p className="tkd-err" data-tk="field-error">{message}</p> : <p className="tkd-hint">{t("post.v2.det.cityHint")}</p>}
    </div>
  );
}
