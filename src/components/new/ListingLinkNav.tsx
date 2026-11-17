import Link from "next/link";
import "./listing-link-nav.css";

export type LinkItem = { href: string; label: string };

/**
 * A short list of links under a listing page (related searches, nearby cities): a small bold heading on its own line and the links as the same
 * pills as the city pills above (class `tk-pill`). Nothing is drawn when there are no links.
 */
export function ListingLinkNav({ title, label, links, max }: { title: string; label: string; links: readonly LinkItem[]; max: number }) {
  const shown = links.slice(0, Math.max(1, max));
  if (shown.length === 0) return null;
  return (
    <nav className="tk-link-nav" aria-label={label} data-tk="listing-link-nav">
      <p className="tk-link-nav-title">{title}</p>
      <div className="tk-pills tk-pills-left">
        {shown.map((link) => (
          <Link key={link.href} href={link.href} className="tk-pill" prefetch={false}>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
