import type { ReactNode } from "react";
import type { TextFn } from "@/lib/ui/text";
import { SearchBar, SearchChips, SearchTop } from "./SearchHeader";
import { searchChips, searchHref, type SearchChip, type SearchState } from "./search-header";
import type { ListingLabels } from "./listing-filters";

export const SEARCH_BASE = "/search/";

export type TemplateInput = {
  state: SearchState;
  crumbs: { name: string; path: string }[];
  h1: string;
  total: number;
  /** The page shows ads close by because it has few of its own. */
  nearby: boolean;
  placeName?: string;
  /** The address of this page without filters, used for "Best match" in the sort. */
  pagePath: string;
  t: TextFn;
};

/** The same filters as a /search/ address: the page's own category and place are filters too. */
export function templateParams(state: SearchState): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  if (state.q) params.q = state.q;
  if (state.category) params.category = state.category.slug;
  if (state.state) params.state = state.state.slug;
  if (state.city) params.city = state.city.slug;
  if (state.area) params.area = state.area.slug;
  if (state.toggles.verified) params.verified = "1";
  if (state.toggles.photos) params.photos = "1";
  if (state.toggles.video) params.video = "1";
  if (state.toggles.online) params.online = "1";
  for (const [key, pick] of Object.entries(state.picks)) {
    if (Array.isArray(pick)) params[`f.${key}`] = pick;
    else {
      if (pick.min !== undefined) params[`f.${key}_min`] = String(pick.min);
      if (pick.max !== undefined) params[`f.${key}_max`] = String(pick.max);
    }
  }
  return params;
}

export type TemplateHeader = { top: ReactNode; bar: ReactNode; chips: ReactNode };

/**
 * H7.104: the header every listing page shares with /search/: breadcrumb, H1, count, sort, and the chips of the active
 * filters. No photo band and no second search box. Removing a chip goes to /search/ with the other filters kept.
 */
export function templateHeader(input: TemplateInput, labels: ListingLabels): { header: TemplateHeader; chips: SearchChip[]; params: Record<string, string | string[]> } {
  const { state, t } = input;
  const params = templateParams(state);
  const chips = searchChips(SEARCH_BASE, params, state, labels, t);
  const sortOptions = [
    { value: "best", label: t("search.sort.best"), href: input.pagePath },
    { value: "newest", label: t("search.sort.newest"), href: searchHref(SEARCH_BASE, { ...params, sort: "newest" }) },
    { value: "online", label: t("search.sort.online"), href: searchHref(SEARCH_BASE, { ...params, sort: "online" }) },
    { value: "verified", label: t("search.sort.verified"), href: searchHref(SEARCH_BASE, { ...params, sort: "verified" }) },
  ];
  return {
    params,
    chips,
    header: {
      top: <SearchTop crumbs={input.crumbs} breadcrumbLabel={labels.breadcrumb} heading={input.h1} />,
      bar: <SearchBar total={input.total} place={input.placeName} nearby={input.nearby} sortValue="best" sortOptions={sortOptions} t={t} />,
      chips: <SearchChips chips={chips} clearHref={SEARCH_BASE} t={t} />,
    },
  };
}
