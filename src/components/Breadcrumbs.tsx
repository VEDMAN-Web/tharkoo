import Link from "next/link";

export function Breadcrumbs({
  crumbs,
  backHref,
  backLabel = "< Back to search",
}: {
  crumbs: { name: string; path: string }[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <nav className="crumbs-nav" aria-label="breadcrumb">
      {backHref ? (
        <div className="goback">
          <Link href={backHref} className="no-underline">
            {backLabel}
          </Link>
        </div>
      ) : null}
      <ol className="crumbs-list">
        {crumbs.map((c, i) => (
          <li key={c.path} className="crumbs-item">
            {i > 0 ? <span className="crumbs-sep">›</span> : null}
            {i === crumbs.length - 1 ? (
              <span>{c.name}</span>
            ) : (
              <Link href={c.path} className="no-underline">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
