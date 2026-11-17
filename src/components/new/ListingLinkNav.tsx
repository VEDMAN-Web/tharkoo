import Link from "next/link";

export type LinkItem = { href: string; label: string };

/** A short list of links under a listing page (related categories, nearby cities): a title and up to `max` links. Nothing is drawn when there are none. */
export function ListingLinkNav({ title, label, links, max }: { title: string; label: string; links: readonly LinkItem[]; max: number }) {
  const shown = links.slice(0, Math.max(1, max));
  if (shown.length === 0) return null;
  return (
    <nav className="tk-seo-foot" aria-label={label} data-tk="listing-link-nav">
      <strong>{title} </strong>
      {shown.map((link) => (
        <Link key={link.href} href={link.href} prefetch={false}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
