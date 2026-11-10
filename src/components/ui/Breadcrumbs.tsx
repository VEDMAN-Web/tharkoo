import Link from "next/link";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";

export function Breadcrumbs({
  crumbs,
  jsonLd = false,
}: {
  crumbs: { name: string; path: string }[];
  backHref?: string;
  backLabel?: string;
  jsonLd?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      {jsonLd ? <JsonLd data={breadcrumbJsonLd(crumbs)} /> : null}
      <ol className="flex min-w-0 flex-wrap items-center gap-1 t-caption text-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          const hide = crumbs.length > 3 && index > 0 && index < crumbs.length - 2;
          return (
            <li key={crumb.path} className={hide ? "hidden sm:flex sm:items-center sm:gap-1" : "flex min-w-0 items-center gap-1"}>
              {index > 0 ? <span aria-hidden>›</span> : null}
              {hide ? <span className="sm:hidden">…</span> : null}
              {last ? (
                <span aria-current="page" className="truncate text-text">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="truncate hover:text-gold" prefetch={false}>
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
