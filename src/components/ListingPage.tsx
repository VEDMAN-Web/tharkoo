"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { AdCard } from "./AdCard";
import { EmptyState } from "./ui/EmptyState";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { faqPage } from "@/lib/seo/schema";
import { canonical } from "@/lib/seo";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import { adPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";

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
  query,
  suggestions = [],
  photos,
  verified,
  locationLabel,
  cityName,
  categoryName,
  districts = [],
  faqs = [],
  popular = [],
  updated,
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
  query?: string;
  suggestions?: { href: string; label: string }[];
  photos?: boolean;
  verified?: boolean;
  locationLabel?: string;
  cityName?: string;
  categoryName?: string;
  districts?: { href: string; label: string }[];
  faqs?: { q: string; a: string }[];
  popular?: { href: string; label: string }[];
  updated?: string;
}) {
  const [open, setOpen] = useState(false);
  const paths = useUrlPaths();
  const clear = path.split("?")[0];
  const chips = districts.slice(0, 2);
  const feed = [...stars, ...items.filter((ad) => !stars.some((star) => star.slug && star.slug === ad.slug))];
  const related = siblingLinks.slice(0, 5);
  const short = cityName && categoryName ? `${cityName} ${categoryName}` : crumbs[crumbs.length - 1]?.name;

  return (
    <div className="tk-container" style={{ paddingTop: 16, paddingBottom: 24 }}>
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
              url: canonical(adPath(paths, ad.slug || "")),
              name: displayTitle(ad.title),
            })),
          },
          ...(faqs.length
            ? [faqPage(faqs)]
            : []),
        ]}
      />
      <button type="button" className="tk-loc" data-tk="location-field" onClick={() => window.dispatchEvent(new Event("tk-open-search"))}>
        <MapPin size={18} aria-hidden />
        <span>{locationLabel || query || "Select a city"}</span>
        <span className="tk-loc-go" aria-hidden>
          <Search size={16} color="#fff" />
        </span>
      </button>
      <div className="tk-filters">
        <Link className={`tk-filter ${verified ? "is-on" : ""}`} data-tk="filter-chip" href={toggleHref(path, "verified", !!verified)} prefetch={false}>
          Verified
        </Link>
        <Link className={`tk-filter ${photos ? "is-on" : ""}`} data-tk="filter-chip" href={toggleHref(path, "photos", !!photos)} prefetch={false}>
          With photos
        </Link>
        {chips.map((link) => (
          <Link key={link.href} className="tk-filter" data-tk="filter-chip" href={link.href} prefetch={false}>
            {link.label}
          </Link>
        ))}
      </div>
      <div className="tk-hair" />
      <nav className="tk-crumbs tk-crumbs-full" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={crumb.path} style={{ position: "relative" }}>
              {index > 0 ? <span style={{ color: "var(--muted)" }}> / </span> : null}
              {last && districts.length ? (
                <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                  {crumb.name} ▾
                </button>
              ) : (
                <Link href={crumb.path} prefetch={false}>
                  {crumb.name}
                </Link>
              )}
              {last && open ? (
                <span className="tk-crumb-menu">
                  {districts.map((item) => (
                    <Link key={item.href} href={item.href} prefetch={false}>
                      {item.label}
                    </Link>
                  ))}
                </span>
              ) : null}
            </span>
          );
        })}
      </nav>
      {short ? (
        <nav className="tk-crumbs tk-crumbs-short" aria-label="Breadcrumb">
          <button type="button" onClick={() => setOpen((v) => !v)}>
            {short} ▾
          </button>
          {open ? (
            <span className="tk-crumb-menu">
              {districts.map((item) => (
                <Link key={item.href} href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </span>
          ) : null}
        </nav>
      ) : null}
      <h1 className="tk-listing-h1">{h1}</h1>
      {updated ? <p className="tk-listing-updated">Updated {updated}</p> : null}
      <div className="tk-feed">
        {feed.map((ad, index) => (
          <span key={ad.publicId || ad.slug || index} style={{ display: "contents" }}>
            <AdCard ad={ad} featured={index < stars.length} priority={index === 0} />
            {(index + 1) % 6 === 0 ? (
              <Link href={postAdPath(paths)} className="tk-promo" data-tk="promo-band" prefetch={false}>
                <span>
                  <h2>Reach more people</h2>
                  <p>Promote your ad and stay at the top.</p>
                </span>
                <span className="tk-btn" data-tk="post-ad">POST YOUR AD</span>
              </Link>
            ) : null}
          </span>
        ))}
      </div>
      {!feed.length ? (
        query ? (
          <div className="tk-empty">
            {suggestions.map((item) => (
              <Link key={item.href} href={item.href} className="tk-pill" prefetch={false}>
                {item.label}
              </Link>
            ))}
            <EmptyState title="No listings yet" body="Try another word, or post the first ad." action={{ href: postAdPath(paths), label: "Post the first ad" }} />
          </div>
        ) : (
          <EmptyState
            title="No listings yet"
            body={emptyNearby.length ? "Try a nearby city, or be the first to post." : "Be the first to post in this place."}
            action={{ href: postAdPath(paths), label: "Post the first ad" }}
          />
        )
      ) : null}
      {page < pages ? (
        <div className="tk-more">
          <Link href={pageHref(path, page + 1)} rel="next" className="tk-btn tk-btn-outline-gold" data-tk="show-more" prefetch={false}>
            Show more
          </Link>
        </div>
      ) : null}
      {popular.length ? (
        <nav className="tk-seo-foot" aria-label="Popular searches">
          <strong>Popular searches </strong>
          {popular.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {faqs.length ? (
        <section className="tk-seo-foot">
          {faqs.map((item) => (
            <p key={item.q}>
              <strong>{item.q}</strong> {item.a}
            </p>
          ))}
        </section>
      ) : null}
      {intro
        ? intro.split(/\n+/).map((part) => (
            <p key={part.slice(0, 24)} className="tk-seo-foot">
              {part}
            </p>
          ))
        : null}
      {footer ? <div className="tk-seo-foot">{footer}</div> : null}
      {related.length ? (
        <nav className="tk-seo-foot" aria-label="Nearby">
          <strong>Nearby </strong>
          {related.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
