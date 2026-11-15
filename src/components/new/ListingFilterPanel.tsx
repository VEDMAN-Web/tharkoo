import type { FilterRow } from "./listing-filters";

/**
 * H7.4b: the filter panel of a listing. A plain GET form: each pick is a checkbox named `f.<fieldKey>`, so the page
 * works without JavaScript. Rows are the category's admin fields marked "Use as filter". Rows with picks start open.
 */
export function ListingFilterPanel({
  action,
  rows,
  activeCount,
  verified,
  photos,
  clearHref,
  verifiedLabel,
  photosLabel,
}: {
  action: string;
  rows: FilterRow[];
  activeCount: number;
  verified: boolean;
  photos: boolean;
  clearHref: string;
  verifiedLabel: string;
  photosLabel: string;
}) {
  return (
    <form method="get" action={action} className="tkn-ls-form" aria-label="Filter results">
      <div className="tkn-ls-panelhead">
        <p className="tkn-ls-panelhead-title">
          <SearchIcon />
          Search
        </p>
        <span className="tkn-ls-pill">{activeCount} active</span>
      </div>
      <p className="tkn-ls-label">Filters</p>
      <div className="tkn-ls-quick">
        <ChipCheck name="verified" value="1" checked={verified} label={verifiedLabel} />
        <ChipCheck name="photos" value="1" checked={photos} label={photosLabel} />
      </div>
      {rows.map((row) => (
        <details key={row.key} className="tkn-ls-row" open={row.picked > 0}>
          <summary>
            <span className="tkn-ls-row-label">{row.label}</span>
            {row.picked > 0 ? <span className="tkn-ls-badge">{row.picked}</span> : null}
            <ChevronIcon />
          </summary>
          <div className="tkn-ls-opts">
            {row.options.map((option) => (
              <ChipCheck key={option.value} name={`f.${row.key}`} value={option.value} checked={option.picked} label={option.label} />
            ))}
          </div>
        </details>
      ))}
      <div className="tkn-ls-bottom">
        <a href={clearHref} className="tkn-ls-clear">
          Clear all
        </a>
        <button type="submit" className="tkn-ls-go">
          Search
        </button>
      </div>
    </form>
  );
}

function ChipCheck({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label className="tkn-ls-opt">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8124F" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="tkn-ls-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
