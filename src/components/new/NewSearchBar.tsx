"use client";

import { Search } from "lucide-react";

/**
 * H7.4: the glass search bar used on the New design home page and the listing title band.
 * It opens the same search pop-up as the header button, so the search behaviour does not change.
 */
export function NewSearchBar({ label = "Search by city, category...", buttonText = "Search" }: { label?: string; buttonText?: string }) {
  return (
    <div className="tkn-search-glass" role="group" aria-label="Search">
      <div className="tkn-search-row">
        <button
          type="button"
          className="tkn-search-field"
          data-tk="hero-search"
          onClick={() => window.dispatchEvent(new Event("tk-open-search"))}
        >
          <Search size={20} aria-hidden />
          <span>{label}</span>
        </button>
        <button type="button" className="tkn-search-go" onClick={() => window.dispatchEvent(new Event("tk-open-search"))}>
          {buttonText}
        </button>
      </div>
    </div>
  );
}
