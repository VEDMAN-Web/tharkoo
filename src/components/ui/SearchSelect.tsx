"use client";

import { useId, useMemo, useState } from "react";
import "./search-select.css";

export type SearchOption = { value: string; label: string; hint?: string };

/** A pick list with this many choices or fewer stays a plain select; a longer one becomes a type-ahead (H16.1c). */
export const SEARCH_FROM = 100;
const MAX_SHOWN = 40;

const titleOf = (slug: string) => slug.split("-").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** Choices for a list of places. Two places with the same name (two Aurangabads) show their state beside the name so they can be told apart. */
export function placeChoices<T extends { name: string; stateSlug?: string }>(items: readonly T[], valueOf: (item: T) => string): SearchOption[] {
  const seen = new Map<string, number>();
  for (const item of items) seen.set(item.name, (seen.get(item.name) ?? 0) + 1);
  return items.map((item) => ({ value: valueOf(item), label: item.name, hint: (seen.get(item.name) ?? 0) > 1 && item.stateSlug ? titleOf(item.stateSlug) : undefined }));
}

/** The choices that match what was typed: those that start with it first, then those that contain it. Nothing typed gives the first ones. */
export function matchOptions(options: readonly SearchOption[], typed: string, limit = MAX_SHOWN): SearchOption[] {
  const needle = typed.trim().toLowerCase();
  if (!needle) return options.slice(0, limit);
  const starts: SearchOption[] = [];
  const inside: SearchOption[] = [];
  for (const option of options) {
    const label = option.label.toLowerCase();
    if (label.startsWith(needle)) starts.push(option);
    else if (label.includes(needle) || (option.hint ?? "").toLowerCase().startsWith(needle)) inside.push(option);
    if (starts.length >= limit) break;
  }
  return [...starts, ...inside].slice(0, limit);
}

/**
 * A type-ahead pick list for a long list of places (about 900 cities): a text box that shows only the best matches, never the whole list.
 * It is a combobox: arrows move, Enter picks, Esc closes, a tap picks on a phone. `value` is the option's value; "" means none.
 */
export function SearchSelect({
  id,
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  invalid,
  className,
  inputClassName,
  style,
  ariaLabel,
  dataTk,
  name,
  onBlur,
  onChange,
}: {
  id?: string;
  value: string;
  options: readonly SearchOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** Class of the text box, so a form can give it its own look. */
  inputClassName?: string;
  /** Colour variables for a screen with its own look (--ss-bg, --ss-text, --ss-line, --ss-muted, --ss-active). */
  style?: React.CSSProperties;
  ariaLabel?: string;
  dataTk?: string;
  /** When set, the picked value is also sent with a form under this name. */
  name?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shown = useMemo(() => matchOptions(options, typed ?? ""), [options, typed]);
  const text = typed ?? selected?.label ?? "";

  function choose(option: SearchOption) {
    onChange(option.value);
    setTyped(null);
    setOpen(false);
  }

  function leave() {
    setOpen(false);
    const wanted = (typed ?? "").trim().toLowerCase();
    if (typed !== null) {
      if (wanted === "") onChange("");
      else {
        const exact = options.filter((option) => option.label.toLowerCase() === wanted);
        if (exact.length === 1) onChange(exact[0].value);
      }
    }
    setTyped(null);
    onBlur?.();
  }

  function key(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      setActive((now) => Math.max(0, Math.min(shown.length - 1, now + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" && open && shown[active]) {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setTyped(null);
    }
  }

  return (
    <div className={`tk-ss ${className ?? ""}`} style={style}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        id={id || undefined}
        className={inputClassName}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        data-tk={dataTk}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setTyped(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={key}
        onBlur={leave}
      />
      {open ? (
        <ul id={listId} role="listbox" className="tk-ss-list" aria-label={ariaLabel ?? "Matches"} data-tk="search-select-list" onClick={(event) => event.preventDefault()}>
          {shown.length === 0 ? (
            <li role="presentation" className="tk-ss-empty">{emptyText ?? "No match"}</li>
          ) : (
            shown.map((option, index) => (
              <li
                key={`${option.value}|${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-active={index === active ? "true" : undefined}
                className="tk-ss-option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span>{option.label}</span>
                {option.hint ? <span className="tk-ss-hint">{option.hint}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
