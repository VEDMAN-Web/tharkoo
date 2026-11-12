import { isCityAlias } from "@/lib/seo/district-alias";
import { getCategory, getLocationBySlug } from "@/lib/queries";
import { cleanPath } from "@/lib/urls";
import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { countMatching } from "@/server/search";
import { getPaths, getUrlOverride } from "@/server/urls/service";
import { districtMinimum, getIndexing, hubMinimum, isCategoryOn, isCityOn } from "@/server/seo/indexing";

export type PageType = "home" | "category" | "city" | "district" | "tag" | "ad" | "search" | "other";

/** Same defaults the hub pages use today (category.minListingsIndex ?? 3, minListingsLocality ?? 10). */
export const DEFAULT_MIN_HUB = 3;
export const DEFAULT_MIN_DISTRICT = 10;

export interface ExplainInput {
  pageType: PageType;
  /** Ads on the page's whole list (not just page 1). */
  count?: number;
  minimum?: number;
  page?: number;
  /** URL carries photos= or verified= filters. */
  filtered?: boolean;
  overrideNoindex?: boolean;
  /** Ad pages: the stored seoNoindex flag. */
  adNoindex?: boolean;
  /** Ad pages: slug looks like a seeded demo ad (demo-0001). */
  demoAd?: boolean;
  adEnded?: boolean;
  /** District hub whose name matches its city. */
  aliasDistrict?: boolean;
  /** Switched off in Indexing rules. */
  switchedOff?: "category" | "city";
}

export interface EditorLink {
  label: string;
  href: string;
}

export interface Explanation {
  indexable: boolean;
  /** Plain-English reasons, most important first. */
  reasons: string[];
  editor: EditorLink;
}

const EDITORS: Record<PageType, EditorLink> = {
  home: { label: "Edit home page blocks", href: "/admin/homepage/" },
  category: { label: "Edit the category template", href: "/admin/seo/templates/" },
  city: { label: "Edit the city template", href: "/admin/seo/templates/" },
  district: { label: "Edit the district template", href: "/admin/seo/templates/" },
  tag: { label: "Edit this page override", href: "/admin/urls/" },
  ad: { label: "Edit this page override", href: "/admin/urls/" },
  search: { label: "Edit this page override", href: "/admin/urls/" },
  other: { label: "Edit this page override", href: "/admin/urls/" },
};

export function editorFor(pageType: PageType, hasOverride = false): EditorLink {
  return hasOverride ? { label: "Edit this page override", href: "/admin/urls/" } : EDITORS[pageType];
}

/** Pure decision, mirroring what the pages put in their robots meta. No database. */
export function explainIndexability(input: ExplainInput): Explanation {
  const editor = editorFor(input.pageType, input.overrideNoindex);
  const no = (...reasons: string[]): Explanation => ({ indexable: false, reasons, editor });
  if (input.overrideNoindex) return no("noindex: a page override sets this URL to noindex");
  if (input.switchedOff) {
    return {
      indexable: false,
      reasons: [`noindex and left out of the sitemap: the ${input.switchedOff} is switched off in Indexing rules`],
      editor: { label: "Open Indexing rules", href: "/admin/seo/indexing/" },
    };
  }
  if (input.pageType === "ad") {
    if (input.adEnded) return no("noindex: this ad has ended");
    if (input.demoAd) return no("noindex: demo ad (placeholder content is never indexed)");
    if (input.adNoindex) return no("noindex: this ad is not set to be indexed");
    return { indexable: true, reasons: ["Live ad that is set to be indexed"], editor };
  }
  if (input.pageType === "district" && input.aliasDistrict) {
    return no("redirects (301) to the city page: the district has the same name as its city");
  }
  if ((input.page ?? 1) > 1) return no(`noindex: page ${input.page} of a list (only page 1 is indexed)`);
  if (input.pageType === "search") return no("noindex: search result pages are never indexed");
  const hub = input.pageType === "category" || input.pageType === "city" || input.pageType === "district" || input.pageType === "tag";
  if (!hub) return { indexable: true, reasons: ["Standard page, no thin-content rule applies"], editor };
  const count = input.count ?? 0;
  const minimum = input.minimum ?? (input.pageType === "district" ? DEFAULT_MIN_DISTRICT : DEFAULT_MIN_HUB);
  if (input.filtered && count === 0) return no("noindex: filter parameters with no results");
  if (count < minimum) return no(`noindex: ${count} ${count === 1 ? "ad" : "ads"} < minimum ${minimum}`);
  const reasons = [`${count} ads >= minimum ${minimum}`];
  if (input.filtered) reasons.push("filter parameters are present; the page is indexable while the filter has results");
  return { indexable: true, reasons, editor };
}

const DEMO_SLUG = /^demo-\d{4}$/;

function flag(value: string | null) {
  return value === "1" || value === "true";
}

/** Looks a URL up in the database and explains whether it can be indexed. */
export async function explainUrl(raw: string): Promise<Explanation | { error: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim(), "http://local.invalid");
  } catch {
    return { error: "That is not a URL or path" };
  }
  const path = cleanPath(url.pathname);
  const segments = path.split("/").filter(Boolean);
  const paths = await getPaths();
  const override = await getUrlOverride(path);
  const base: ExplainInput = {
    pageType: "other",
    page: Math.max(1, Number(url.searchParams.get("page")) || 1),
    filtered: flag(url.searchParams.get("photos")) || flag(url.searchParams.get("verified")),
    overrideNoindex: override?.noindex === true,
  };
  if (segments.length === 0) return explainIndexability({ ...base, pageType: "home" });
  if (segments[0] === paths.search || segments[0] === "search") return explainIndexability({ ...base, pageType: "search" });
  if (segments[0] === paths.ad && segments[1]) {
    await connectDb();
    const ad = (await Listing.findOne({ slug: segments[1] }).select("status expiresAt seoNoindex").lean()) as {
      status?: string;
      expiresAt?: Date | null;
      seoNoindex?: boolean;
    } | null;
    if (!ad) return { error: "No ad with that address" };
    const ended = ad.status !== "active" || Boolean(ad.expiresAt && new Date(ad.expiresAt) <= new Date());
    return explainIndexability({
      ...base,
      pageType: "ad",
      adEnded: ended,
      adNoindex: ad.seoNoindex !== false,
      demoAd: DEMO_SLUG.test(segments[1]),
    });
  }
  const category = await getCategory(segments[0]);
  if (!category) return explainIndexability({ ...base, pageType: "other" });
  const rules = await getIndexing();
  const categoryOff = !isCategoryOn(rules, category.slug);
  const citySlug = segments[1];
  const cityOff = segments.length >= 2 && segments[1] !== paths.tag && !isCityOn(rules, citySlug);
  const switchedOff = categoryOff ? ("category" as const) : cityOff ? ("city" as const) : undefined;
  const minHub = hubMinimum(rules, category, cityOff ? undefined : citySlug);
  const minDistrict = districtMinimum(rules, category, cityOff ? undefined : citySlug);
  if (segments.length === 1) {
    const count = await countMatching({ categorySlug: category.slug });
    return explainIndexability({ ...base, pageType: "category", count, minimum: minHub, switchedOff });
  }
  if (segments[1] === paths.tag && segments[2]) {
    const count = await countMatching({ categorySlug: category.slug, tag: segments[2] });
    return explainIndexability({ ...base, pageType: "tag", count, minimum: minHub, switchedOff });
  }
  const place = await getLocationBySlug(segments[1]);
  if (!place) return { error: "No city or state with that address" };
  if (segments.length === 2) {
    const count = await countMatching(
      place.kind === "state" ? { categorySlug: category.slug, stateSlug: place.slug } : { categorySlug: category.slug, citySlug: place.slug },
    );
    return explainIndexability({ ...base, pageType: "city", count, minimum: minHub, switchedOff });
  }
  const district = await getLocationBySlug(segments[2]);
  const count = await countMatching({ categorySlug: category.slug, citySlug: place.slug, districtSlug: segments[2] });
  return explainIndexability({
    ...base,
    pageType: "district",
    count,
    minimum: minDistrict,
    switchedOff,
    aliasDistrict: Boolean(district && isCityAlias(place.name, district.name)),
  });
}

const STATIC_FIRST = new Set([
  "cities",
  "categories",
  "blog",
  "help",
  "contact",
  "about",
  "terms",
  "privacy",
  "cookies",
  "scam-report",
  "safety",
  "how-it-works",
  "prohibited-items",
  "grievance",
]);

/** Best guess of the page type from the address alone (no database), for tables and filters. */
export function pageTypeOfPath(rawPath: string, adPrefix = "listing"): PageType {
  const path = rawPath.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "home";
  if (segments[0] === "search") return "search";
  if (segments[0] === adPrefix && segments[1]) return "ad";
  if (STATIC_FIRST.has(segments[0])) return "other";
  if (segments.length === 1) return "category";
  if (segments[1] === "tag" && segments[2]) return "tag";
  if (segments.length === 2) return "city";
  if (segments.length === 3) return "district";
  return "other";
}
