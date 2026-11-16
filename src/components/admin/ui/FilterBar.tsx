"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Funnel, Search, X } from "lucide-react";
import "@/styles/admin-kit.css";

export type FilterChip = { key: string; label: string; value?: string };
export type FilterChoice = { key: string; label: string };

/**
 * Search box and filter chips above a table (UI-RULES section 4). An active chip shows its value and an X.
 * "Add filter" opens the list of filters that are not on yet. Keep the state in the URL so the view can be shared.
 */
export function FilterBar({
  search,
  onSearch,
  searchLabel = "Search",
  placeholder = "Search",
  chips,
  onRemoveChip,
  addable = [],
  onAdd,
  hint,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchLabel?: string;
  placeholder?: string;
  chips: FilterChip[];
  onRemoveChip: (key: string) => void;
  addable?: FilterChoice[];
  onAdd?: (key: string) => void;
  /** Keyboard hints for queues, shown on desktop only: "J K move, A approve, R reject". */
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: Event) => {
      if (box.current && event.target instanceof Node && !box.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        box.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="adm-k-fbar" role="search" data-tk="filter-bar">
      <label className="adm-k-search">
        <span className="adm-k-sr">{searchLabel}</span>
        <Search aria-hidden="true" focusable="false" />
        <input type="search" value={search} placeholder={placeholder} onChange={(event) => onSearch(event.target.value)} />
      </label>
      {chips.map((chip) => (
        <span key={chip.key} className="adm-k-chip adm-k-chip-on" data-tk="filter-chip">
          {chip.label}
          {chip.value ? `: ${chip.value}` : ""}
          <button type="button" className="adm-k-chip-x" aria-label={`Remove filter ${chip.label}`} onClick={() => onRemoveChip(chip.key)}>
            <X aria-hidden="true" focusable="false" />
          </button>
        </span>
      ))}
      {addable.length > 0 ? (
        <div className="adm-k-more" ref={box}>
          <button type="button" className="adm-k-chip adm-k-chip-add" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
            <Funnel aria-hidden="true" focusable="false" />
            Add filter
          </button>
          {open ? (
            <div className="adm-k-menu" role="menu" id={menuId} aria-label="Filters">
              {addable.map((choice) => (
                <button
                  key={choice.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onAdd?.(choice.key);
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {hint ? <span className="adm-k-hint">{hint}</span> : null}
    </div>
  );
}
