import Link from "next/link";
import type { TextFn } from "@/lib/ui/text";
import { SortSelect, type SortOption } from "./SortSelect";
import type { SearchChip } from "./search-header";

export function SearchHeader({
  crumbs,
  breadcrumbLabel,
  heading,
  total,
  sortValue,
  sortOptions,
  chips,
  clearHref,
  t,
}: {
  crumbs: { name: string; path: string }[];
  breadcrumbLabel: string;
  heading: string;
  total: number;
  sortValue: string;
  sortOptions: SortOption[];
  chips: SearchChip[];
  clearHref: string;
  t: TextFn;
}) {
  return (
    <>
      <nav className="tkn-ls-crumbs" aria-label={breadcrumbLabel}>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.path}-${index}`}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {last ? (
                <span aria-current="page">{crumb.name}</span>
              ) : (
                <Link href={crumb.path} prefetch={false}>
                  {crumb.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      <h1 className="tkn-sr-h1">{heading}</h1>
      <div className="tkn-sr-meta">
        <p className="tkn-sr-count" data-tk="results-count">
          {total === 1 ? t("search.count.one") : t("search.count.many", { count: total.toLocaleString("en-IN") })}
        </p>
        <SortSelect label={t("search.sort.label")} value={sortValue} options={sortOptions} />
      </div>
      {chips.length > 0 ? (
        <ul className="tkn-sr-chips" aria-label={t("search.chips.label")} data-tk="active-chips">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link className="tkn-sr-chip" href={chip.href} prefetch={false} aria-label={chip.removeLabel} data-chip={chip.key}>
                <span>{chip.label}</span>
                <span aria-hidden="true" className="tkn-sr-x">
                  ×
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link className="tkn-sr-clear" href={clearHref} prefetch={false}>
              {t("search.chip.clear")}
            </Link>
          </li>
        </ul>
      ) : null}
    </>
  );
}
