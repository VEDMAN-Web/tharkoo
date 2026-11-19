"use client";

import { Fragment } from "react";
import { withPins } from "@/lib/ui/pins";
import Link from "next/link";
import { UiTextProvider } from "./ui/AdCard";
import { ListingCard, ListingGrid } from "./new/ListingCards";
import { EmptyState } from "./ui/EmptyState";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";
import { itemListNode, webPageNode } from "@/lib/seo/schema";

const SITE_NAME = "Tharkoo";
import { canonical } from "@/lib/seo";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import { adPath, postAdPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { deviceClass } from "./blocks/device";
import type { ListingLayout } from "./blocks/ListingLayout";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import type { BlockBase } from "@/server/models/layout";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import { ListingPager } from "./new/ListingPager";
import { LISTING_PAGE_SIZE, pagerLabels } from "./new/listing-pager";
import "./blocks/blocks.css";

export function ListingPageView({
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
  districts = [],
  faqs = [],
  popular = [],
  layout,
  texts,
  fallback,
  hideEmpty = false,
  pageName,
}: {
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
  districts?: { href: string; label: string }[];
  faqs?: { q: string; a: string }[];
  popular?: { href: string; label: string }[];
  /** Block layout for this page. Without one the built-in layout is used, which is the page as it always was. */
  layout?: ListingLayout;
  /** Admin-edited UI text overrides (see /admin/ui-text/). Without them the built-in text is used. */
  texts?: UiTextMap;
  /** H7.32: fallback ads under the page's own results (see FallbackAds). Drawn after the feed. */
  fallback?: React.ReactNode;
  /** H7.32: leave out the built-in empty state, for a page that draws its own under the fallback. */
  hideEmpty?: boolean;
  /** H17.5: the page's heading, the name of its WebPage node. Without it no WebPage node is written. */
  pageName?: string;
}) {
  const t = makeT(texts);
  const paths = useUrlPaths();
  const clear = path.split("?")[0];
  const feed = withPins(stars, items, page);

  const blocks: BlockBase[] = (layout?.blocks ?? listingDefaultBlocks()).filter((block) => block.type !== "listingHeader" && block.type !== "filters");
  const nodes = layout?.nodes ?? {};
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

  const feedBlock = () => {
    const emptyTitle = typeof feedProps.emptyTitle === "string" && feedProps.emptyTitle.trim() ? feedProps.emptyTitle : t("listing.empty.title");
    const emptyText = typeof feedProps.emptyText === "string" ? feedProps.emptyText.trim() : "";
    return (
      <>
        {feed.length ? (
          <ListingGrid label={t("listing.feed.label")}>
            {feed.map((ad, index) => (
              <Fragment key={ad.publicId || ad.slug || index}>
                <li>
                  <ListingCard ad={ad} order={index} texts={texts} />
                </li>
                {inFeedEvery > 0 && (index + 1) % inFeedEvery === 0 ? (
                  <li className="tkn-grid-wide">
                    {inFeedId && nodes[inFeedId] ? (
                      nodes[inFeedId]
                    ) : (
                      <Link href={postAdPath(paths)} className="tk-promo" data-tk="promo-band" prefetch={false}>
                        <span>
                          <h2>{t("listing.promo.title")}</h2>
                          <p>{t("listing.promo.text")}</p>
                        </span>
                        <span className="tk-btn" data-tk="post-ad">{t("listing.promo.button")}</span>
                      </Link>
                    )}
                  </li>
                ) : null}
              </Fragment>
            ))}
          </ListingGrid>
        ) : null}
        {!feed.length && !hideEmpty ? (
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
        <ListingPager base={path} page={page} pages={pages} total={total} size={LISTING_PAGE_SIZE} labels={pagerLabels(t)} />
        {fallback}
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

  const body = (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          ...(pageName ? [webPageNode({ name: pageName, path: clear, siteName: SITE_NAME })] : []),
          itemListNode({
            url: canonical(clear),
            items: items.map((ad, i) => ({
              position: (page - 1) * LISTING_PAGE_SIZE + i + 1,
              url: canonical(adPath(paths, ad.slug || "")),
              name: displayTitle(ad.title),
            })),
          }),
        ]}
      />
      {blocks.map((block, index) => (
        <span key={block.id} style={{ display: "contents" }}>
          {index === tailAt ? seoTail : null}
          {section(block)}
        </span>
      ))}
      {tailAt >= blocks.length ? seoTail : null}
    </>
  );
  return <UiTextProvider texts={texts}>{body}</UiTextProvider>;
}
