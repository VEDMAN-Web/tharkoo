/**
 * H7.4b: the filter panel of a category or city listing. Pure: no database and no request object, so the pages and the
 * tests share it. The panel has fixed rows (Verified, With photos, With video, Online now) and one row per category field
 * that is marked "Use as filter": pick-one and pick-many fields as chips, number ranges as Min and Max, yes/no as one chip.
 * Short text fields are never filters.
 */
import { parseFieldFilters, type ListingParams } from "@/server/search/filter-seo";

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

export type RangePick = { min?: number; max?: number };
/** The picks on a listing URL, per field key: chips as a list of options, a range as its bounds, yes/no as ["1"]. */
export type AttributePicks = Record<string, string[] | RangePick>;
/** The quick toggles on a listing URL. `online` (H7.8) is "Online now": sellers who are online at the moment. */
export type ListingToggles = { verified: boolean; photos: boolean; video: boolean; online?: boolean };

export type IconKind = "list" | "range" | "toggle";
export type PanelRow =
  | { kind: "choice"; key: string; label: string; icon: IconKind; picked: number; options: { value: string; label: string; picked: boolean }[] }
  | { kind: "range"; key: string; label: string; icon: IconKind; picked: number; min: string; max: string }
  | { kind: "boolean"; key: string; label: string; icon: IconKind; picked: number; checked: boolean };

const CHOICE_TYPES = new Set(["select", "multiselect"]);
const RANGE_TYPES = new Set(["range", "number"]);
const BOOLEAN_TYPES = new Set(["boolean", "bool"]);

/** The fields a visitor can filter by: enabled, marked as a filter, in admin order. */
export function filterableFields(fields: readonly FilterField[] | undefined): FilterField[] {
  return (fields ?? [])
    .filter((field) => field.filterable === true && field.enabled !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function toNumber(text: string): number | undefined {
  if (text === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * The picks on a listing URL, read against the category's filter fields. Keys that are not filter fields are dropped,
 * so a URL cannot filter by a field the category does not offer. Ranges read `f.<key>_min` and `f.<key>_max`.
 */
export function attributePicks(params: ListingParams, fields: readonly FilterField[] | undefined): AttributePicks {
  // Every f.<key> goes through the shared parser in filter-seo.ts, so hyphenated keys are read like any other key.
  // Only keys of this category's filter fields are kept, so a URL cannot filter by a field the category does not offer.
  const parsed = parseFieldFilters(params);
  const out: AttributePicks = {};
  for (const field of filterableFields(fields)) {
    const type = String(field.type);
    const values = parsed[field.key] ?? [];
    if (RANGE_TYPES.has(type)) {
      const min = toNumber(parsed[field.key + "_min"]?.[0] ?? "");
      const max = toNumber(parsed[field.key + "_max"]?.[0] ?? "");
      if (min !== undefined || max !== undefined) out[field.key] = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
    } else if (BOOLEAN_TYPES.has(type)) {
      if (values.includes("1")) out[field.key] = ["1"];
    } else if (CHOICE_TYPES.has(type)) {
      const allowed = new Set(field.options ?? []);
      const picks = values.filter((value) => allowed.has(value));
      if (picks.length > 0) out[field.key] = picks;
    }
  }
  return out;
}

function iconFor(type: string): IconKind {
  if (RANGE_TYPES.has(type)) return "range";
  if (BOOLEAN_TYPES.has(type)) return "toggle";
  return "list";
}

/** One panel row per filter field, with its current picks. */
export function panelRows(fields: readonly FilterField[] | undefined, picks: AttributePicks): PanelRow[] {
  return filterableFields(fields).flatMap((field): PanelRow[] => {
    const type = String(field.type);
    const pick = picks[field.key];
    const label = field.label || field.key;
    if (RANGE_TYPES.has(type)) {
      const range: RangePick = pick && !Array.isArray(pick) ? pick : {};
      const picked = range.min !== undefined || range.max !== undefined ? 1 : 0;
      return [{ kind: "range", key: field.key, label, icon: iconFor(type), picked, min: range.min !== undefined ? String(range.min) : "", max: range.max !== undefined ? String(range.max) : "" }];
    }
    if (BOOLEAN_TYPES.has(type)) {
      const checked = Array.isArray(pick) && pick.includes("1");
      return [{ kind: "boolean", key: field.key, label, icon: iconFor(type), picked: checked ? 1 : 0, checked }];
    }
    if (CHOICE_TYPES.has(type) && (field.options?.length ?? 0) > 0) {
      const picked = new Set(Array.isArray(pick) ? pick : []);
      const options = (field.options ?? []).map((value) => ({ value, label: field.optionLabels?.[value] || value, picked: picked.has(value) }));
      return [{ kind: "choice", key: field.key, label, icon: iconFor(type), picked: picked.size, options }];
    }
    return [];
  });
}

/** The number on the "Filters · N" button and the "N active" pill: every pick plus each quick toggle that is on. */
export function activeFilterCount(rows: readonly PanelRow[], toggles: ListingToggles): number {
  const picks = rows.reduce((sum, row) => sum + row.picked, 0);
  return picks + (toggles.verified ? 1 : 0) + (toggles.photos ? 1 : 0) + (toggles.video ? 1 : 0) + (toggles.online ? 1 : 0);
}

/** The query string for the filters that are on, so pagination and the panel keep them. Empty when nothing is on. */
export function listingFilterQuery(picks: AttributePicks, toggles: ListingToggles): string {
  const params = new URLSearchParams();
  for (const [key, pick] of Object.entries(picks)) {
    if (Array.isArray(pick)) {
      for (const value of pick) params.append(`f.${key}`, value);
    } else {
      if (pick.min !== undefined) params.append(`f.${key}_min`, String(pick.min));
      if (pick.max !== undefined) params.append(`f.${key}_max`, String(pick.max));
    }
  }
  if (toggles.verified) params.set("verified", "1");
  if (toggles.photos) params.set("photos", "1");
  if (toggles.video) params.set("video", "1");
  if (toggles.online) params.set("online", "1");
  return params.toString();
}

/** True when at least one field pick is on, so the attribute filter has to be sent to the feed. */
export function hasFieldPicks(picks: AttributePicks): boolean {
  return Object.keys(picks).length > 0;
}

/** The visible words of the band and the panel, from the UI-text store (see src/lib/ui/text.ts). */
export type ListingLabels = {
  keyword: string;
  search: string;
  filters: string;
  all: string;
  close: string;
  breadcrumb: string;
  panelTitle: string;
  activeTemplate: string;
  filtersLabel: string;
  category: string;
  state: string;
  city: string;
  area: string;
  allCategories: string;
  allStates: string;
  allCities: string;
  allAreas: string;
  pickCity: string;
  clear: string;
  apply: string;
  show: string;
  showOne: string;
  noFilters: string;
  verified: string;
  photos: string;
  video: string;
  online: string;
  min: string;
  max: string;
};

/** One entry of a place select. `href` is the clean SEO URL it navigates to. */
export type PlaceOption = {
  value: string;
  label: string;
  href: string;
  /** The country slug of a state or city (H7.4d). Absent for categories and "All" entries: they are always shown. */
  country?: string;
};

/** The four place selects of the filter panel. An empty areas list means the select is disabled. */
export type PlaceSelects = {
  categories: PlaceOption[];
  categoryValue: string;
  states: PlaceOption[];
  stateValue: string;
  cities: PlaceOption[];
  cityValue: string;
  areas: PlaceOption[];
  areaValue: string;
};
