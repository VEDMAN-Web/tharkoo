import Link from "next/link";

/** Says why there is nothing to show and what to do next. */
export function EmptyState({
  title,
  why,
  action,
}: {
  title: string;
  why?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="adm-empty">
      <h2>{title}</h2>
      {why ? <p>{why}</p> : null}
      {action ? (
        <Link href={action.href} className="adm-btn">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
