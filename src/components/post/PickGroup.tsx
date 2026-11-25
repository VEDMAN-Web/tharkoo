"use client";

import { useId, useMemo, useState } from "react";
import { useT } from "@/components/help/UiTextProvider";
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
  const t = useT();
  const headId = useId();
  const [query, setQuery] = useState("");
  const searchable = options.length > PICK_SEARCH_THRESHOLD;
  const { chips, matches } = useMemo(() => visibleOptions(options, selected, query), [options, selected, query]);
  const full = mode === "many" && selected.length >= max;
  const hint = mode === "one" ? t("post.pick.one") : t("post.pick.many", { max, picked: selected.length }) + (full ? t("post.pick.limit") : "");

  return (
    <fieldset className="tk-pick" data-tk={label} aria-describedby={error ? `${headId}-error` : undefined}>
      <legend className="tk-pick-legend">
        {label}
        {required ? " *" : ""}
      </legend>
      <div className="tk-pick-head">
        {help ? <span className="tk-pick-help">{help}</span> : <span />}
        <span className="tk-pick-hint" data-tk="pick-count">{hint}</span>
      </div>
      {searchable ? (
        <input
          type="search"
          className="tk-pick-search"
          aria-label={t("post.pick.searchLabel", { label })}
          placeholder={t("post.pick.searchPlaceholder", { count: options.length.toLocaleString("en-IN") })}
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
        <p className="tk-pick-more">{t("post.pick.showing", { shown: chips.length, matches: matches.toLocaleString("en-IN") })}</p>
      ) : null}
      {searchable && matches === 0 ? <p className="tk-pick-more">{t("post.pick.none")}</p> : null}
      {error ? (
        <span id={`${headId}-error`} className="tk-error" role="alert" data-tk="field-error">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
