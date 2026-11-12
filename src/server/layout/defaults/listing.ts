import type { BlockBase } from "@/server/models/layout";

/**
 * The listing hub page as it is today, written as blocks (category, city and district pages share it).
 * The ids are fixed so the pages can use this list when no layout is published; saving a layout makes the server issue its own ids.
 *
 * - `filters`: location field, Verified / With photos chips (and up to two area chips).
 * - `listingHeader`: breadcrumbs, the h1 ("{h1}" is the heading the page already works out from the SEO templates) and the Updated line.
 * - `listingFeed`: the ads, the in-feed "Reach more people" band every 6 ads, the empty state and Show more.
 * - `relatedCategories`: the "Popular searches" links.
 * - `nearbyCities`: the "Nearby" links, up to 5.
 * The SEO text under the feed (questions, intro, footer from the SEO templates) is written by the page and sits just before the nearby links.
 */
export function listingDefaultBlocks(): BlockBase[] {
  return [
    {
      id: "builtin-filters",
      type: "filters",
      visible: true,
      label: "Location and filters",
      props: { enabled: ["verified", "photos"], showOnMobileAs: "inline" },
    },
    {
      id: "builtin-header",
      type: "listingHeader",
      visible: true,
      label: "Page heading",
      props: { h1Template: "{h1}", introTemplate: "", showCount: false, showUpdated: true },
    },
    {
      id: "builtin-feed",
      type: "listingFeed",
      visible: true,
      label: "Ads",
      props: { perPage: 24, cardFields: ["photo", "location", "badges"], inFeedEvery: 6, emptyTitle: "No listings yet", emptyText: "" },
    },
    { id: "builtin-popular", type: "relatedCategories", visible: true, label: "Popular searches", props: { title: "Popular searches", max: 6 } },
    { id: "builtin-nearby", type: "nearbyCities", visible: true, label: "Nearby", props: { title: "Nearby", max: 5 } },
  ];
}

/** Template variables a listing layout may use. `h1` is the heading the page works out on its own. */
export const LISTING_TEMPLATE_VARS = ["h1", "category", "city", "district", "state", "count", "year", "site"] as const;
