import type { TextFn } from "@/lib/ui/text";
import type { AttributePicks, FilterField, ListingLabels, ListingToggles } from "./listing-filters";

export type SearchState = {
  q?: string;
  category?: { slug: string; name: string };
  state?: { slug: string; name: string };
  city?: { slug: string; name: string };
  area?: { slug: string; name: string };
  toggles: ListingToggles;
  picks: AttributePicks;
  fields?: readonly FilterField[];
  sort?: string;
};

export type SearchChip = { key: string; label: string; removeLabel: string; href: string };

export const SORT_VALUES = ["newest", "online", "verified"] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export function sortFrom(raw: string | undefined): SortValue | "" {
  return (SORT_VALUES as readonly string[]).includes(raw ?? "") ? (raw as SortValue) : "";
}

export function categoryAds(name: string): string {
  return /\bads?$/i.test(name.trim()) ? name.trim() : `${name.trim()} ads`;
}

export function searchHeading(state: Pick<SearchState, "q" | "category" | "state" | "city" | "area">, t: TextFn): string {
  if (state.q) return t("search.heading.keyword", { q: state.q });
  const place = state.area && state.city ? `${state.area.name}, ${state.city.name}` : state.city?.name || state.state?.name || "";
  if (state.category) return t("search.heading.category", { category: categoryAds(state.category.name), place: place || "India" });
  return place ? t("search.heading.place", { place }) : t("search.heading.all");
}

export function searchHref(base: string, params: Record<string, string | string[] | undefined>, drop: readonly string[] = []): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined || drop.includes(key)) continue;
    for (const item of [value].flat()) if (item) query.append(key, item);
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

export function searchChips(
  base: string,
  params: Record<string, string | string[] | undefined>,
  state: SearchState,
  labels: Pick<ListingLabels, "category" | "state" | "city" | "area" | "verified" | "photos" | "video" | "online">,
  t: TextFn,
): SearchChip[] {
  const chips: SearchChip[] = [];
  const add = (key: string, label: string, drop: readonly string[]) =>
    chips.push({ key, label, removeLabel: t("search.chip.remove", { name: label }), href: searchHref(base, params, drop) });
  if (state.q) add("q", `${t("search.chip.keyword")}: ${state.q}`, ["q"]);
  if (state.category) add("category", `${labels.category}: ${state.category.name}`, ["category", ...Object.keys(params).filter((key) => key.startsWith("f."))]);
  if (state.state) add("state", `${labels.state}: ${state.state.name}`, ["state"]);
  if (state.city) add("city", `${labels.city}: ${state.city.name}`, ["city", "location", "area"]);
  if (state.area) add("area", `${labels.area}: ${state.area.name}`, ["area"]);
  if (state.toggles.verified) add("verified", labels.verified, ["verified"]);
  if (state.toggles.photos) add("photos", labels.photos, ["photos"]);
  if (state.toggles.video) add("video", labels.video, ["video"]);
  if (state.toggles.online) add("online", labels.online, ["online"]);
  for (const [key, pick] of Object.entries(state.picks)) {
    const field = state.fields?.find((item) => item.key === key);
    const name = field?.label || key;
    const value = Array.isArray(pick)
      ? pick.map((option) => field?.optionLabels?.[option] || option).join(", ")
      : [pick.min !== undefined ? `${pick.min}` : "", pick.max !== undefined ? `${pick.max}` : ""].join(" - ").replace(/^ - | - $/g, "");
    const drop = Object.keys(params).filter((param) => param === `f.${key}` || param === `f.${key}_min` || param === `f.${key}_max`);
    add(`f.${key}`, `${name}: ${value}`, drop);
  }
  return chips;
}
