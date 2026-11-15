import { BadgeCheck, Circle, Image as ImageIcon, ListFilter, SlidersHorizontal, ToggleRight, Video } from "lucide-react";
import { ListingPlaceSelects } from "./ListingPlaceSelects";
import type { IconKind, ListingLabels, ListingToggles, PanelRow, PlaceSelects } from "./listing-filters";

/**
 * H7.4b: the filter panel of a listing. It always renders: the place selects, the fixed rows (Verified, With photos,
 * With video, Online now) and one row per category filter field. A plain GET form, so the filters work without
 * JavaScript; only the place selects need JavaScript to navigate.
 */
export function ListingFilterPanel({
  action,
  clearHref,
  rows,
  activeCount,
  toggles,
  labels,
  places,
}: {
  action: string;
  clearHref: string;
  rows: PanelRow[];
  activeCount: number;
  toggles: ListingToggles;
  labels: ListingLabels;
  places: PlaceSelects;
}) {
  return (
    <form method="get" action={action} className="tkn-ls-form" aria-label={labels.panelTitle}>
      <div className="tkn-ls-panelhead">
        <p className="tkn-ls-panelhead-title">
          <SearchIcon />
          {labels.panelTitle}
        </p>
        <span className="tkn-ls-pill">{labels.activeTemplate.replace("{count}", String(activeCount))}</span>
      </div>
      <ListingPlaceSelects selects={places} labels={labels} />
      <p className="tkn-ls-label">{labels.filtersLabel}</p>
      <div className="tkn-ls-fixed">
        <ChipLine icon="verified" name="verified" label={labels.verified} checked={toggles.verified} />
        <ChipLine icon="photos" name="photos" label={labels.photos} checked={toggles.photos} />
        <ChipLine icon="video" name="video" label={labels.video} checked={toggles.video} />
        <div className="tkn-ls-chipline is-disabled" aria-disabled="true">
          <FixedIcon icon="online" />
          <span>{labels.online}</span>
          <span className="tkn-ls-soon">{labels.soon}</span>
        </div>
      </div>
      {rows.length === 0 ? <p className="tkn-ls-empty">{labels.noFilters}</p> : null}
      {rows.map((row) => {
        if (row.kind === "boolean") {
          return <ChipLine key={row.key} icon="toggle" name={`f.${row.key}`} value="1" label={row.label} checked={row.checked} />;
        }
        return (
          <details key={row.key} className="tkn-ls-row" open={row.picked > 0}>
            <summary>
              <FilterIcon kind={row.icon} />
              <span className="tkn-ls-row-label">{row.label}</span>
              {row.picked > 0 ? <span className="tkn-ls-badge">{row.picked}</span> : null}
              <ChevronIcon />
            </summary>
            {row.kind === "choice" ? (
              <div className="tkn-ls-opts">
                {row.options.map((option) => (
                  <label key={option.value} className="tkn-ls-opt">
                    <input type="checkbox" name={`f.${row.key}`} value={option.value} defaultChecked={option.picked} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="tkn-ls-range">
                <label>
                  <span>{labels.min}</span>
                  <input type="number" inputMode="numeric" min={0} name={`f.${row.key}_min`} defaultValue={row.min} />
                </label>
                <label>
                  <span>{labels.max}</span>
                  <input type="number" inputMode="numeric" min={0} name={`f.${row.key}_max`} defaultValue={row.max} />
                </label>
              </div>
            )}
          </details>
        );
      })}
      <div className="tkn-ls-bottom">
        <a href={clearHref} className="tkn-ls-clear">
          {labels.clear}
        </a>
        <button type="submit" className="tkn-ls-go">
          {labels.apply}
        </button>
      </div>
    </form>
  );
}

function ChipLine({ icon, name, value, label, checked }: { icon: "verified" | "photos" | "video" | "toggle"; name: string; value?: string; label: string; checked: boolean }) {
  return (
    <label className="tkn-ls-chipline">
      <input type="checkbox" name={name} value={value ?? "1"} defaultChecked={checked} />
      {icon === "toggle" ? <FilterIcon kind="toggle" /> : <FixedIcon icon={icon} />}
      <span>{label}</span>
    </label>
  );
}

function FixedIcon({ icon }: { icon: "verified" | "photos" | "video" | "online" }) {
  const common = { size: 16, "aria-hidden": true as const };
  if (icon === "verified") return <BadgeCheck {...common} />;
  if (icon === "photos") return <ImageIcon {...common} />;
  if (icon === "video") return <Video {...common} />;
  return <Circle {...common} />;
}

function FilterIcon({ kind }: { kind: IconKind }) {
  const common = { size: 16, "aria-hidden": true as const };
  if (kind === "range") return <SlidersHorizontal {...common} />;
  if (kind === "toggle") return <ToggleRight {...common} />;
  return <ListFilter {...common} />;
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
