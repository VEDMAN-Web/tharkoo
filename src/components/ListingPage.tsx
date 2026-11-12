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
import { deviceClass } from "./blocks/device";
import type { ListingLayout } from "./blocks/ListingLayout";
import { listingHeading } from "@/lib/layout/listing";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import type { BlockBase } from "@/server/models/layout";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import "./blocks/blocks.css";

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
  layout,
  texts,
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
  /** Block layout for this page. Without one the built-in layout is used, which is the page as it always was. */
  layout?: ListingLayout;
  /** Admin-edited UI text overrides (see /admin/ui-text/). Without them the built-in text is used. */
  texts?: UiTextMap;
}) {
  const [open, setOpen] = useState(false);
  const t = makeT(texts);
  const paths = useUrlPaths();
  const clear = path.split("?")[0];
  const chips = districts.slice(0, 2);
  const feed = [...stars, ...items.filter((ad) => !stars.some((star) => star.slug && star.slug === ad.slug))];
  const short = cityName && categoryName ? `${cityName} ${categoryName}` : crumbs[crumbs.length - 1]?.name;

  const blocks: BlockBase[] = layout?.blocks ?? listingDefaultBlocks();
  const nodes = layout?.nodes ?? {};
  const vars = { ...(layout?.vars ?? {}), h1, count: total };
  const feedProps = (blocks.find((block) => block.type === "listingFeed")?.props ?? {}) as Record<string, unknown>;
  const inFeedId = typeof feedProps.inFeedBlockId === "string" ? feedProps.inFeedBlockId : "";
  const inFeedEvery = Number(feedProps.inFeedEvery) || 0;
  const nearbyAt = blocks.findIndex((block) => block.type === "nearbyCities");
  const tailAt = nearbyAt >= 0 ? nearbyAt : blocks.length;

  const wrap = (block: BlockBase, content: React.ReactNode) => {
    const cls = deviceClass(block.devices);
    return cls ? (
      <div key={block.id} className={cls}>
        {content}
      </div>
    ) : (
      <span key={block.id} style={{ display: "contents" }}>
        {content}
      </span>
    );
  };

  const filtersBlock = (block: BlockBase) => {
    const enabled = Array.isArray(block.props.enabled) ? (block.props.enabled as string[]) : ["verified", "photos"];
    return (
      <>
        <button type="button" className="tk-loc" data-tk="location-field" onClick={() => window.dispatchEvent(new Event("tk-open-search"))}>
          <MapPin size={18} aria-hidden />
          <span>{locationLabel || query || t("listing.location.select")}</span>
          <span className="tk-loc-go" aria-hidden>
            <Search size={16} color="#fff" />
          </span>
        </button>
        <div className="tk-filters">
          {enabled.includes("verified") ? (
            <Link className={`tk-filter ${verified ? "is-on" : ""}`} data-tk="filter-chip" href={toggleHref(path, "verified", !!verified)} prefetch={false}>
              {t("listing.filters.verified")}
            </Link>
          ) : null}
          {enabled.includes("photos") ? (
            <Link className={`tk-filter ${photos ? "is-on" : ""}`} data-tk="filter-chip" href={toggleHref(path, "photos", !!photos)} prefetch={false}>
              {t("listing.filters.photos")}
            </Link>
          ) : null}
          {chips.map((link) => (
            <Link key={link.href} className="tk-filter" data-tk="filter-chip" href={link.href} prefetch={false}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="tk-hair" />
      </>
    );
  };

  const headerBlock = (block: BlockBase) => {
    const heading = listingHeading(String(block.props.h1Template ?? ""), h1, vars);
    const introText = listingHeading(String(block.props.introTemplate ?? ""), "", vars);
    return (
      <>
        <nav className="tk-crumbs tk-crumbs-full" aria-label={t("listing.crumb.label")}>
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
          <nav className="tk-crumbs tk-crumbs-short" aria-label={t("listing.crumb.label")}>
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
        <h1 className="tk-listing-h1">{heading}</h1>
        {block.props.showCount ? <p className="tk-listing-updated">{t("listing.count", { count: total })}</p> : null}
        {updated && block.props.showUpdated !== false ? <p className="tk-listing-updated">{t("listing.updated", { date: updated })}</p> : null}
        {introText ? <p className="tk-listing-intro">{introText}</p> : null}
      </>
    );
  };

  const feedBlock = () => {
    const emptyTitle = typeof feedProps.emptyTitle === "string" && feedProps.emptyTitle.trim() ? feedProps.emptyTitle : t("listing.empty.title");
    const emptyText = typeof feedProps.emptyText === "string" ? feedProps.emptyText.trim() : "";
    return (
      <>
        <div className="tk-feed">
          {feed.map((ad, index) => (
            <span key={ad.publicId || ad.slug || index} style={{ display: "contents" }}>
              <AdCard ad={ad} featured={index < stars.length} priority={index === 0} />
              {inFeedEvery > 0 && (index + 1) % inFeedEvery === 0 ? (
                inFeedId && nodes[inFeedId] ? (
                  nodes[inFeedId]
                ) : (
                  <Link href={postAdPath(paths)} className="tk-promo" data-tk="promo-band" prefetch={false}>
                    <span>
                      <h2>{t("listing.promo.title")}</h2>
                      <p>{t("listing.promo.text")}</p>
                    </span>
                    <span className="tk-btn" data-tk="post-ad">{t("listing.promo.button")}</span>
                  </Link>
                )
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
              <EmptyState title={emptyTitle} body={emptyText || t("listing.empty.search")} action={{ href: postAdPath(paths), label: t("listing.empty.post") }} />
            </div>
          ) : (
            <EmptyState
              title={emptyTitle}
              body={emptyText || (emptyNearby.length ? t("listing.empty.nearby") : t("listing.empty.first"))}
              action={{ href: postAdPath(paths), label: t("listing.empty.post") }}
            />
          )
        ) : null}
        {page < pages ? (
          <div className="tk-more">
            <Link href={pageHref(path, page + 1)} rel="next" className="tk-btn tk-btn-outline-gold" data-tk="show-more" prefetch={false}>
              {t("listing.more")}
            </Link>
          </div>
        ) : null}
      </>
    );
  };

  const linkNav = (title: string, label: string, links: { href: string; label: string }[], max: number) => {
    const shown = links.slice(0, Math.max(1, max));
    if (!shown.length) return null;
    return (
      <nav className="tk-seo-foot" aria-label={label}>
        <strong>{title} </strong>
        {shown.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false}>
            {link.label}
          </Link>
        ))}
      </nav>
    );
  };

  // The SEO text written from the SEO templates: questions, intro paragraphs and footer. It sits just before the nearby links.
  const seoTail = (
    <>
      {faqs.length ? (
        <section className="tk-seo-foot" data-reveal>
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
    </>
  );

  const section = (block: BlockBase) => {
    const title = (fallback: string) => (typeof block.props.title === "string" && block.props.title.trim() ? block.props.title : fallback);
    const max = (fallback: number) => Number(block.props.max) || fallback;
    switch (block.type) {
      case "filters":
        return wrap(block, filtersBlock(block));
      case "listingHeader":
        return wrap(block, headerBlock(block));
      case "listingFeed":
        return wrap(block, feedBlock());
      case "relatedCategories":
        return wrap(block, linkNav(title(t("listing.links.popular")), t("listing.links.popular"), popular, max(6)));
      case "districtLinks":
        return wrap(block, linkNav(title(t("listing.links.areas")), t("listing.links.areas"), districts, max(10)));
      case "nearbyCities":
        return wrap(block, linkNav(title(t("listing.links.nearby")), t("listing.links.nearby"), siblingLinks, max(5)));
      default:
        // A block used as the in-feed band is drawn inside the feed, not here.
        return block.id === inFeedId ? null : wrap(block, nodes[block.id] ?? null);
    }
  };

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
          ...(faqs.length ? [faqPage(faqs)] : []),
        ]}
      />
      {blocks.map((block, index) => (
        <span key={block.id} style={{ display: "contents" }}>
          {index === tailAt ? seoTail : null}
          {section(block)}
        </span>
      ))}
      {tailAt >= blocks.length ? seoTail : null}
    </div>
  );
}
