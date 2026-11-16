"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import "./listing-spec.css";
import type { ListingLabels } from "./listing-filters";

/**
 * H7.4b: the frame of a category or city listing (New design). It draws the title band (breadcrumb, H1, intro,
 * sub-category chips and the search form), then the grid: the filter panel on the left and the ads on the right.
 * Below 600 px the filter panel becomes a bottom sheet opened by a "Filters" button next to the search box.
 * The parts come from the server page; this component only owns the open state of the sheet.
 */
export function ListingFrame({
  bandStyle,
  labels,
  head,
  chips,
  searchForm,
  filters,
  activeCount,
  header,
  children,
}: {
  /** The band image as CSS variables (see bandStyleFor). */
  bandStyle?: Record<string, string>;
  labels: Pick<ListingLabels, "filters" | "close">;
  head?: ReactNode;
  chips?: ReactNode;
  searchForm?: ReactNode;
  filters: ReactNode;
  activeCount: number;
  header?: { top: ReactNode; bar: ReactNode; chips: ReactNode };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasPhoto = Boolean(bandStyle?.["--band-desk"] || bandStyle?.["--band-phone"]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filtersButton = (
    <button type="button" className="tkn-ls-filter-btn" aria-expanded={open} aria-controls="tkn-ls-aside" onClick={() => setOpen(true)}>
      <SlidersHorizontal size={16} aria-hidden="true" />
      {`${labels.filters} · ${activeCount}`}
    </button>
  );

  return (
    <div className="tkn-ls">
      {header ? (
        <>
          <section className="tkn-sr-head m-enter" data-tk="results-header">
            {header.top}
          </section>
          <div className="tkn-sr-bar" data-tk="results-bar">
            {header.bar}
            {filtersButton}
          </div>
          {header.chips}
        </>
      ) : (
        <>
          <section className="tkn-ls-band m-enter" data-tk="listing-band" data-photo={hasPhoto ? "true" : "false"} style={(bandStyle ?? {}) as CSSProperties}>
            <div className="tkn-ls-band-card">
              {head}
              {chips ? <div className="tkn-ls-chips">{chips}</div> : null}
              <div className="tkn-ls-searchrow">{searchForm}</div>
            </div>
          </section>
          <div className="tkn-sr-bar tkn-sr-bar-solo" data-tk="results-bar">
            {filtersButton}
          </div>
        </>
      )}
      <div className="tkn-ls-grid">
        <button type="button" className="tkn-ls-scrim" data-open={open ? "true" : "false"} aria-label={labels.close} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
        <aside id="tkn-ls-aside" className="tkn-ls-aside" data-open={open ? "true" : "false"} onClick={(event) => ((event.target as HTMLElement).closest("[data-sheet-close]") ? setOpen(false) : undefined)}>
          <button type="button" className="tkn-ls-sheet-close" onClick={() => setOpen(false)}>
            {labels.close}
          </button>
          {filters}
        </aside>
        <div className="tkn-ls-main">{children}</div>
      </div>
    </div>
  );
}
