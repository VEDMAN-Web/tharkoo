import Link from "next/link";
import { X } from "lucide-react";
import type { TextFn } from "@/lib/ui/text";
import { SortSelect, type SortOption } from "./SortSelect";
import type { SearchChip } from "./search-header";

export function SearchTop({ crumbs, breadcrumbLabel, heading }: { crumbs: { name: string; path: string }[]; breadcrumbLabel: string; heading: string }) {
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
    </>
  );
}

export function SearchBar({
  total,
  place,
  nearby,
  sortValue,
  sortOptions,
  t,
}: {
  total: number;
  place?: string;
  nearby?: boolean;
  sortValue: string;
  sortOptions: SortOption[];
  t: TextFn;
}) {
  const text =
    total === 0 && nearby
      ? place
        ? t("search.count.nonePlace", { place })
        : t("search.count.none")
      : total === 1
        ? t("search.count.one")
        : t("search.count.many", { count: total.toLocaleString("en-IN") });
  return (
    <div className="tkn-sr-meta">
      <p className="tkn-sr-count" data-tk="results-count">
        {text}
      </p>
      <SortSelect label={t("search.sort.label")} value={sortValue} options={sortOptions} />
    </div>
  );
}

export function SearchChips({ chips, clearHref, t }: { chips: SearchChip[]; clearHref: string; t: TextFn }) {
  if (chips.length === 0) return null;
  return (
    <div className="tkn-sr-chipswrap">
      <ul className="tkn-sr-chips" aria-label={t("search.chips.label")} data-tk="active-chips">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link className="tkn-sr-chip" href={chip.href} prefetch={false} aria-label={chip.removeLabel} data-chip={chip.key}>
              <span>{chip.label}</span>
              <X size={14} strokeWidth={2.5} aria-hidden="true" focusable="false" className="tkn-sr-x" />
            </Link>
          </li>
        ))}
        <li>
          <Link className="tkn-sr-clear" href={clearHref} prefetch={false}>
            {t("search.chip.clear")}
          </Link>
        </li>
      </ul>
    </div>
  );
}
