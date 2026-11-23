import { ToggleRight } from "lucide-react";
import { ListingPlaceSelects } from "./ListingPlaceSelects";
import { KeywordField } from "./KeywordField";
import { InstantForm } from "./InstantForm";
import { FilterAccordions } from "./FilterAccordions";
import type { ListingLabels, ListingToggles, PanelRow, PlaceSelects } from "./listing-filters";

/**
 * H7.4b: the filter panel of a listing. It always renders: the place selects, the category's own switches and one accordion
 * per category filter field. H19.1: no Verified, With photos, With video or Online now buttons, and no "no filters" line. H7.91: a fixed, compact column that never
 * scrolls; filters apply at once. Only the place selects and the accordions need JavaScript.
 */
export type KeywordProps = React.ComponentProps<typeof KeywordField>;

export function ListingFilterPanel({
  action,
  clearHref,
  rows,
  activeCount,
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
  toggles?: ListingToggles;
  labels: ListingLabels;
  places: PlaceSelects;
  hidden?: { name: string; value: string }[];
  placesOnly?: boolean;
  keyword?: KeywordProps;
  total?: number;
}) {
  return (
    <InstantForm action={action} className="tkn-ls-form" label={labels.panelTitle}>
      {hidden.map((field) => (
        <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <div className="tkn-ls-panelhead">
        <p className="tkn-ls-panelhead-title">
          {labels.filtersLabel}
          <span className="tkn-ls-pill" data-tk="filter-count">{activeCount}</span>
        </p>
        {activeCount > 0 ? (
          <a href={clearHref} className="tkn-ls-clear-link">
            {labels.clear}
          </a>
        ) : null}
      </div>
      {keyword ? <KeywordField {...keyword} /> : null}
      <ListingPlaceSelects selects={places} labels={labels} />
      {placesOnly ? null : <FilterRows rows={rows} labels={labels} />}
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

function FilterRows({ rows, labels }: { rows: PanelRow[]; labels: ListingLabels }) {
  const picks = rows.filter((row): row is Exclude<PanelRow, { kind: "boolean" }> => row.kind !== "boolean");
  const switches = rows.filter((row) => row.kind === "boolean");
  return (
    <>
      {switches.length > 0 ? (
        <div className="tkn-ls-fixed">
          {rows.map((row) =>
            row.kind === "boolean" ? <ChipLine key={row.key} name={`f.${row.key}`} value="1" label={row.label} checked={row.checked} /> : null,
          )}
        </div>
      ) : null}
      {picks.length > 0 ? <FilterAccordions rows={picks} labels={labels} /> : null}
    </>
  );
}

function ChipLine({ name, value, label, checked }: { name: string; value?: string; label: string; checked: boolean }) {
  return (
    <label className="tkn-ls-chipline">
      <input type="checkbox" name={name} value={value ?? "1"} defaultChecked={checked} />
      <ToggleRight size={16} aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
