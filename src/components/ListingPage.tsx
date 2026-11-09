import Link from "next/link";
import { AdCard, StarStrip } from "./AdCard";
import { Breadcrumbs } from "./Breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import type { ListingDoc } from "@/lib/models";

function toggleHref(path: string, key: string, on: boolean) {
  const [base, qs] = path.split("?");
  const params = new URLSearchParams(qs || "");
  if (on) params.delete(key);
  else params.set(key, "1");
  params.delete("page");
  const next = params.toString();
  return next ? `${base}?${next}` : base;
}

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
  siblingLinks,
  emptyNearby,
  photos,
  verified,
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
  photos?: boolean;
  verified?: boolean;
}) {
  const action = path.split("?")[0];
  const backHref = crumbs.length > 1 ? crumbs[crumbs.length - 2]?.path : "/";

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: total,
            url: canonical(path.split("?")[0]),
            itemListElement: items.map((ad, i) => ({
              "@type": "ListItem",
              position: (page - 1) * 25 + i + 1,
              url: canonical(`/ad/${ad.slug}/`),
              name: ad.title,
            })),
          },
        ]}
      />
      <Breadcrumbs crumbs={crumbs} backHref={backHref} />
      <h1 className="listing-h1">{h1}</h1>
      {h2 ? <h2 className="listing-h2">{h2}</h2> : null}
      {intro ? <p className="listing-intro">{intro}</p> : null}

      <div className="listing-filters">
        <Link href={toggleHref(path, "photos", !!photos)} className={`listingfilters ${photos ? "on" : ""} no-underline`}>
          With photos
        </Link>
        <Link href={toggleHref(path, "verified", !!verified)} className={`listingfilters ${verified ? "on" : ""} no-underline`}>
          Verified
        </Link>
        {siblingLinks.slice(0, 8).map((l) => (
          <Link key={l.href} href={l.href} className="listingfilters no-underline">
            {l.label}
          </Link>
        ))}
      </div>
      <p className="listing-count">{total} ads</p>

      <div className="listing-feed">
        <StarStrip ads={stars} />
        {items.length ? (
          items.map((ad) => <AdCard key={ad.publicId} ad={ad} />)
        ) : (
          <div className="listing-empty">
            <p>No live ads on this page yet.</p>
            {emptyNearby.length ? (
              <p>
                Try nearby:{" "}
                {emptyNearby.map((n) => (
                  <Link key={n.href} href={n.href} className="mr-2">
                    {n.label}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {pages > 1 ? (
        <nav className="listing-pager">
          {Array.from({ length: pages }, (_, i) => i + 1)
            .slice(0, 12)
            .map((n) => (
              <Link key={n} href={`${action}${n === 1 ? "" : `?page=${n}`}`} className={n === page ? "on" : ""}>
                {n}
              </Link>
            ))}
        </nav>
      ) : null}
      {footer ? <p className="listing-footer">{footer}</p> : null}
    </>
  );
}
