/**
 * H7.4b: the filter panel rows for a category listing, built from the category's admin fields marked "Use as filter".
 * Pure: no database and no request object, so the page and the tests share it. Only pick-one and pick-many fields
 * that have options become rows; other kinds (text, range, yes/no) are not listed here.
 */

export type FilterField = {
  key: string;
  label?: string;
  type?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
  enabled?: boolean;
  filterable?: boolean;
  order?: number;
};

export type FilterOption = { value: string; label: string; picked: boolean };
export type FilterRow = { key: string; label: string; picked: number; options: FilterOption[] };

/** The picks on a listing URL: `f.<fieldKey>=<option>` keyed by field key. */
export type SelectedFilters = Record<string, string[]>;

const CHOICE_TYPES = new Set(["select", "multiselect"]);

export function filterRows(fields: readonly FilterField[] | undefined, selected: SelectedFilters): FilterRow[] {
  return (fields ?? [])
    .filter((field) => field.filterable === true && field.enabled !== false && CHOICE_TYPES.has(String(field.type)) && (field.options?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((field) => {
      const picks = new Set(selected[field.key] ?? []);
      const options = (field.options ?? []).map((value) => ({
        value,
        label: field.optionLabels?.[value] || value,
        picked: picks.has(value),
      }));
      return { key: field.key, label: field.label || field.key, picked: options.filter((option) => option.picked).length, options };
    });
}

/** The number on the "Filters" button and the "N active" pill: every pick plus the two quick toggles that are on. */
export function activeFilterCount(rows: readonly FilterRow[], toggles: { verified: boolean; photos: boolean }): number {
  const picks = rows.reduce((sum, row) => sum + row.picked, 0);
  return picks + (toggles.verified ? 1 : 0) + (toggles.photos ? 1 : 0);
}

/** The query string for the filters that are on, so pagination keeps them. Empty when nothing is on. */
export function listingFilterQuery(selected: SelectedFilters, toggles: { verified: boolean; photos: boolean }): string {
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(selected)) {
    for (const value of values) params.append(`f.${key}`, value);
  }
  if (toggles.verified) params.set("verified", "1");
  if (toggles.photos) params.set("photos", "1");
  return params.toString();
}

/** True when at least one field pick is on, so the attribute filter has to be sent to the feed. */
export function hasFieldPicks(selected: SelectedFilters): boolean {
  return Object.values(selected).some((values) => values.length > 0);
}
