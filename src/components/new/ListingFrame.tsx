"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
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
  children,
}: {
  /** The band image as CSS variables (see bandStyleFor). */
  bandStyle: Record<string, string>;
  labels: Pick<ListingLabels, "filters" | "close">;
  head: ReactNode;
  chips?: ReactNode;
  searchForm: ReactNode;
  filters: ReactNode;
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasPhoto = Boolean(bandStyle["--band-desk"] || bandStyle["--band-phone"]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="tkn-ls">
      <section className="tkn-ls-band m-enter" data-tk="listing-band" data-photo={hasPhoto ? "true" : "false"} style={bandStyle as CSSProperties}>
        <div className="tkn-ls-band-card">
          {head}
          {chips ? <div className="tkn-ls-chips">{chips}</div> : null}
          <div className="tkn-ls-searchrow">
            {searchForm}
            <button type="button" className="tkn-ls-filter-btn" aria-expanded={open} aria-controls="tkn-ls-aside" onClick={() => setOpen(true)}>
              {`${labels.filters} · ${activeCount}`}
            </button>
          </div>
        </div>
      </section>
      <div className="tkn-ls-grid">
        <button type="button" className="tkn-ls-scrim" data-open={open ? "true" : "false"} aria-label={labels.close} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
        <aside id="tkn-ls-aside" className="tkn-ls-aside" data-open={open ? "true" : "false"}>
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
