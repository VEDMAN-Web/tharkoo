import type { ListingParams } from "@/server/search/filter-seo";
import type { TextFn } from "@/lib/ui/text";
import type { PagerLabels } from "./ListingPager";

export { LISTING_PAGE_SIZE } from "@/lib/listing-page-size";

export type PagerItem = number | "gap";

export function pagerItems(page: number, pages: number): PagerItem[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const items: PagerItem[] = [];
  sorted.forEach((n, index) => {
    const before = sorted[index - 1];
    if (before !== undefined && n - before === 2) items.push(before + 1);
    else if (before !== undefined && n - before > 2) items.push("gap");
    items.push(n);
  });
  return items;
}

export function pageHref(base: string, n: number): string {
  const [path, query] = base.split("?");
  const params = new URLSearchParams(query || "");
  if (n <= 1) params.delete("page");
  else params.set("page", String(n));
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

export function pageBase(path: string, params: ListingParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const item of [value].flat()) query.append(key, item);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export function showingRange(page: number, size: number, total: number) {
  if (total <= 0) return { from: 0, to: 0 };
  return { from: (page - 1) * size + 1, to: Math.min(page * size, total) };
}

export function pagerLabels(t: TextFn): PagerLabels {
  return {
    nav: t("listing.pager.nav"),
    prev: t("listing.pager.prev"),
    prevShort: t("listing.pager.prevShort"),
    next: t("listing.pager.next"),
    showing: t("listing.pager.showing"),
    status: t("listing.pager.status"),
    pageLabel: t("listing.pager.page"),
  };
}
