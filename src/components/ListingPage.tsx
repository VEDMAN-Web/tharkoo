import Link from "next/link";
import { AdCard, StarStrip } from "./AdCard";
import { Breadcrumbs } from "./Breadcrumbs";
import { Chip, ChipRow } from "./ui/Chip";
import { Container } from "./ui/Container";
import { EmptyState } from "./ui/EmptyState";
import { RecentlyViewedRail } from "./ui/RecentlyViewed";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { displayTitle } from "@/lib/format";
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

function pageHref(path: string, n: number) {
  const [base, qs] = path.split("?");
  const params = new URLSearchParams(qs || "");
  if (n <= 1) params.delete("page");
  else params.set("page", String(n));
  const next = params.toString();
  return next ? `${base}?${next}` : base;
}

export function ListingPageView({
  h1,
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
  const clear = path.split("?")[0];
  const related = siblingLinks.slice(0, 8);
  return (
    <Container className="py-6">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: total,
            url: canonical(clear),
            itemListElement: items.map((ad, i) => ({
              "@type": "ListItem",
              position: (page - 1) * 25 + i + 1,
              url: canonical(`/ad/${ad.slug}/`),
              name: displayTitle(ad.title),
            })),
          },
        ]}
      />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="t-h1">{h1}</h1>
      {intro ? <p className="t-lead mt-3 max-w-[68ch] text-muted">{intro}</p> : null}
      <div className="sticky top-16 z-20 mt-4 bg-bg/90 py-2 backdrop-blur">
        <ChipRow>
          <Chip href={toggleHref(path, "verified", !!verified)} selected={!!verified}>
            Verified
          </Chip>
          <Chip href={toggleHref(path, "photos", !!photos)} selected={!!photos}>
            With photos
          </Chip>
          {related.map((link) => (
            <Chip key={link.href} href={link.href}>
              {link.label}
            </Chip>
          ))}
          {photos || verified ? (
            <Chip href={clear}>Clear all</Chip>
          ) : null}
        </ChipRow>
      </div>
      <p className="t-small mt-3 text-muted">{total} ads</p>
      <StarStrip ads={stars} />
      {items.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {items.map((ad) => (
            <AdCard key={ad.publicId || ad.slug} ad={ad} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="generic"
          title="No listings yet"
          body={emptyNearby.length ? "Try a nearby city, or be the first to post." : "Be the first to post in this place."}
          action={{ href: "/u/post-insert/", label: "Post the first ad" }}
        />
      )}
      {pages > 1 ? (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(path, page - 1)} rel="prev" className="quiet-btn" prefetch={false}>
              Previous
            </Link>
          ) : null}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .slice(0, 12)
            .map((n) => (
              <Link key={n} href={pageHref(path, n)} className={`quiet-btn ${n === page ? "text-gold" : ""}`} aria-current={n === page ? "page" : undefined} prefetch={false}>
                {n}
              </Link>
            ))}
          {page < pages ? (
            <Link href={pageHref(path, page + 1)} rel="next" className="quiet-btn" prefetch={false}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
      {related.length ? (
        <div className="mt-10">
          <h2 className="t-h2">Nearby</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((link) => (
              <Link key={link.href} href={link.href} prefetch={false} className="t-small text-gold">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <RecentlyViewedRail />
      {footer ? <p className="t-small mt-8 max-w-[68ch] text-muted">{footer}</p> : null}
    </Container>
  );
}
