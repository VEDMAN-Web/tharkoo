import Link from "next/link";
import { BadgeCheck, Circle, Image as ImageIcon, ToggleRight, Video } from "lucide-react";
import { ListingPlaceSelects } from "./ListingPlaceSelects";
import { KeywordField } from "./KeywordField";
import { InstantForm } from "./InstantForm";
import { FilterAccordions } from "./FilterAccordions";
import type { ListingLabels, ListingToggles, PanelRow, PlaceSelects } from "./listing-filters";

/**
 * H7.4b: the filter panel of a listing. It always renders: the place selects, the toggles (Verified, With photos,
 * With video, Online now) and one accordion per category filter field. H7.91: a fixed, compact column that never
 * scrolls; filters apply at once. Only the place selects and the accordions need JavaScript.
 */
export type KeywordProps = React.ComponentProps<typeof KeywordField>;

export function ListingFilterPanel({
  action,
  clearHref,
  rows,
  activeCount,
  toggles,
  labels,
  places,
  hidden = [],
  placesOnly = false,
  keyword,
  total,
}: {
  action: string;
  clearHref: string;
  rows: PanelRow[];
  activeCount: number;
  toggles: ListingToggles;
  labels: ListingLabels;
  places: PlaceSelects;
  hidden?: { name: string; value: string }[];
  placesOnly?: boolean;
  keyword?: KeywordProps;
  total?: number;
}) {
  // What the server rendered as on: the form is set to match it whenever it changes (see InstantForm).
  const syncKey = JSON.stringify([
    toggles,
    rows.map((row) => [row.key, row.kind === "range" ? [row.min, row.max] : row.kind === "choice" ? row.options.filter((o) => o.picked).map((o) => o.value) : row.checked]),
  ]);
  return (
    <InstantForm action={action} className="tkn-ls-form" label={labels.panelTitle} syncKey={syncKey}>
      {hidden.map((field) => (
        <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <div className="tkn-ls-panelhead">
        <p className="tkn-ls-panelhead-title">
          {labels.filtersLabel}
          <span className="tkn-ls-pill" data-tk="filter-count">{activeCount}</span>
        </p>
        {activeCount > 0 ? (
          <Link href={clearHref} prefetch={false} scroll={false} className="tkn-ls-clear-link">
            {labels.clear}
          </Link>
        ) : null}
      </div>
      {keyword ? <KeywordField {...keyword} /> : null}
      <ListingPlaceSelects selects={places} labels={labels} />
      {placesOnly ? null : <FilterRows rows={rows} toggles={toggles} labels={labels} hasCategory={Boolean(places.categoryValue)} />}
      {placesOnly ? null : (
        <div className="tkn-ls-bottom">
          <button type="submit" className="tkn-ls-go" data-sheet-close="" data-tk="show-count">
            {total === undefined ? labels.apply : total === 1 ? labels.showOne : labels.show.replace("{count}", total.toLocaleString("en-IN"))}
          </button>
        </div>
      )}
    </InstantForm>
  );
}

function FilterRows({ rows, toggles, labels, hasCategory }: { rows: PanelRow[]; toggles: ListingToggles; labels: ListingLabels; hasCategory: boolean }) {
  const picks = rows.filter((row): row is Exclude<PanelRow, { kind: "boolean" }> => row.kind !== "boolean");
  return (
    <>
      <div className="tkn-ls-fixed">
        <ChipLine icon="verified" name="verified" label={labels.verified} checked={toggles.verified} />
        <ChipLine icon="photos" name="photos" label={labels.photos} checked={toggles.photos} />
        <ChipLine icon="video" name="video" label={labels.video} checked={toggles.video} />
        <ChipLine icon="online" name="online" label={labels.online} checked={Boolean(toggles.online)} />
        {rows.map((row) =>
          row.kind === "boolean" ? <ChipLine key={row.key} icon="toggle" name={`f.${row.key}`} value="1" label={row.label} checked={row.checked} /> : null,
        )}
      </div>
      {rows.length === 0 && hasCategory ? <p className="tkn-ls-empty">{labels.noFilters}</p> : null}
      {picks.length > 0 ? <FilterAccordions rows={picks} labels={labels} /> : null}
    </>
  );
}

function ChipLine({ icon, name, value, label, checked }: { icon: "verified" | "photos" | "video" | "online" | "toggle"; name: string; value?: string; label: string; checked: boolean }) {
  return (
    <label className="tkn-ls-chipline">
      <input type="checkbox" name={name} value={value ?? "1"} defaultChecked={checked} />
      {icon === "toggle" ? <ToggleRight size={16} aria-hidden="true" /> : <FixedIcon icon={icon} />}
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
