import Link from "next/link";
import type { ListingLabels } from "./listing-filters";

/**
 * H7.4b: the top of a listing title band: breadcrumb, H1 and intro. The H1 and intro come from the page's
 * admin text (the layout's header block), so the code keeps no fixed wording here.
 */
export function ListingHead({
  crumbs,
  h1,
  intro,
  labels,
}: {
  crumbs: { name: string; path: string }[];
  h1: string;
  intro?: string;
  labels: Pick<ListingLabels, "breadcrumb">;
}) {
  return (
    <>
      <nav className="tkn-ls-crumbs" aria-label={labels.breadcrumb}>
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
      <h1 className="tkn-ls-h1">{h1}</h1>
      {intro ? <p className="tkn-ls-intro">{intro}</p> : null}
    </>
  );
}
