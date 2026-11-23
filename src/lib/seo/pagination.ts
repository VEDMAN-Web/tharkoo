import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

/**
 * H17.3: page 2 and later say which page they are, in the title and the heading. The number goes before the site name
 * ("Dating in Surat (page 2) | Tharkoo"), so every page of a list has its own words.
 */
export function pagedText(text: string, page: number): string {
  if (!Number.isFinite(page) || page <= 1) return text;
  const cut = text.lastIndexOf(" | ");
  const label = ` (page ${Math.floor(page)})`;
  return cut < 0 ? `${text}${label}` : `${text.slice(0, cut)}${label}${text.slice(cut)}`;
}

export function withPagination(meta: Metadata, path: string, page: number, pages: number): Metadata {
  const href = (n: number) => canonical(n <= 1 ? path : `${path}?page=${n}`);
  const pagination = {
    ...(page > 1 && page <= pages ? { previous: href(page - 1) } : {}),
    ...(page < pages ? { next: href(page + 1) } : {}),
  };
  return Object.keys(pagination).length ? { ...meta, pagination } : meta;
}
