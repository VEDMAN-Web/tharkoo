import Link from "next/link";
import type { ListingParams } from "@/server/search/filter-seo";

export function ListingMore({ page, pages, params, label }: { page: number; pages: number; params: ListingParams; label: string }) {
  if (page >= pages) return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const item of [value].flat()) query.append(key, item);
  }
  query.set("page", String(page + 1));
  return (
    <div className="tkn-ls-more">
      <Link href={`?${query.toString()}`} rel="next" scroll={false} prefetch={false} className="tkn-ls-more-btn" data-tk="show-more">
        {label}
      </Link>
    </div>
  );
}
