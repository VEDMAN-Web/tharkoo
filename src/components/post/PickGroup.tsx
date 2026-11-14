"use client";

import { useId, useMemo, useState } from "react";
import { visibleOptions, togglePick, PICK_SEARCH_THRESHOLD } from "@/lib/ui/pick-options";
import "./pick-group.css";

export interface PickGroupProps {
  label: string;
  help?: string;
  required?: boolean;
  options: string[];
  /** "many" for a pick-many field, "one" for a pick-one field. */
  mode: "many" | "one";
  /** Most picks allowed for a pick-many field. */
  max: number;
  selected: string[];
  error?: string;
  onChange: (next: string[]) => void;
}


export function PickGroup({ label, help, required, options, mode, max, selected, error, onChange }: PickGroupProps) {
  const headId = useId();
  const [query, setQuery] = useState("");
  const searchable = options.length > PICK_SEARCH_THRESHOLD;
  const { chips, matches } = useMemo(() => visibleOptions(options, selected, query), [options, selected, query]);
  const full = mode === "many" && selected.length >= max;
  const hint = mode === "one" ? "Pick one" : `Pick up to ${max} · ${selected.length} picked${full ? " · limit reached" : ""}`;

  return (
    <fieldset className="tk-pick" data-tk={label} aria-describedby={error ? `${headId}-error` : undefined}>
      <legend className="tk-pick-legend">
        {required ? "* " : ""}
        {label}
      </legend>
      <div className="tk-pick-head">
        {help ? <span className="tk-pick-help">{help}</span> : <span />}
        <span className="tk-pick-hint" data-tk="pick-count">{hint}</span>
      </div>
      {searchable ? (
        <input
          type="search"
          className="tk-pick-search"
          aria-label={`Search ${label}`}
          placeholder={`Search ${options.length.toLocaleString("en-IN")} options`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}
      <div className="tk-pick-list">
        {chips.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className="tk-pick-chip"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(togglePick(selected, option, mode, max))}
            >
              {option}
            </button>
          );
        })}
      </div>
      {searchable && matches > chips.length ? (
        <p className="tk-pick-more">Showing {chips.length} of {matches.toLocaleString("en-IN")} matches. Type more to narrow the list.</p>
      ) : null}
      {searchable && matches === 0 ? <p className="tk-pick-more">No option matches that search.</p> : null}
      {error ? (
        <span id={`${headId}-error`} className="tk-error" role="alert" data-tk="field-error">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
