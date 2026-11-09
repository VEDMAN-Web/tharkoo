import Link from "next/link";
import { AdCard, StarStrip } from "./AdCard";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import type { ListingDoc } from "@/lib/models";

export function ListingPageView({
  h1,
  h2,
  intro,
  footer,
  crumbs,
  path,
  stars,
  items,
  page,
  pages,
  total,
  noindex,
  siblingLinks,
  emptyNearby,
}: {
  h1: string;
  h2?: string;
  intro?: string;
  footer?: string;
  crumbs: { name: string; path: string }[];
  path: string;
  stars: ListingDoc[];
  items: ListingDoc[];
  page: number;
  pages: number;
  total: number;
  noindex?: boolean;
  siblingLinks: { href: string; label: string }[];
  emptyNearby: { href: string; label: string }[];
}) {
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: total,
        url: canonical(path),
        itemListElement: items.map((ad, i) => ({
          "@type": "ListItem",
          position: (page - 1) * 25 + i + 1,
          url: canonical(`/ad/${ad.slug}/`),
          name: ad.title,
        })),
      }]} />
      <nav className="mb-3 text-sm text-[var(--text-secondary)]">
        {crumbs.map((c, i) => (
          <span key={c.path}>
            {i > 0 ? " › " : null}
            <Link href={c.path}>{c.name}</Link>
          </span>
        ))}
      </nav>
      <h1 className="text-3xl font-semibold">{h1}</h1>
      {h2 ? <h2 className="mt-1 text-lg text-[var(--text-secondary)]">{h2}</h2> : null}
      {intro ? <p className="mt-3 max-w-3xl text-sm leading-6">{intro}</p> : null}
      {siblingLinks.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {siblingLinks.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-gray-200">
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
      <form className="mt-4 flex flex-wrap gap-4 text-sm" action={path}>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="photos" value="1" /> With photos only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="verified" value="1" /> Verified only
        </label>
        <button className="underline">Apply</button>
      </form>
      <div className="mt-6">
        <StarStrip ads={stars} />
        {items.length ? (
          <div className="grid gap-3">
            {items.map((ad) => (
              <AdCard key={ad.publicId} ad={ad} />
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed bg-white p-8 text-sm">
            <p>No live ads on this page yet.</p>
            {emptyNearby.length ? (
              <p className="mt-2">
                Try nearby:{" "}
                {emptyNearby.map((n) => (
                  <Link key={n.href} href={n.href} className="mr-2 underline">
                    {n.label}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {pages > 1 ? (
        <nav className="mt-6 flex gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 12).map((n) => (
            <Link
              key={n}
              href={`${path}${n === 1 ? "" : `?page=${n}`}`}
              className={`rounded px-3 py-1 ring-1 ring-gray-200 ${n === page ? "bg-[var(--brand-primary)] text-white" : "bg-white"}`}
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
      {footer ? <p className="mt-8 text-sm text-[var(--text-secondary)]">{footer}</p> : null}
    </>
  );
}
