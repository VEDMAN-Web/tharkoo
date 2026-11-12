import { fillTemplate, type SeoVars } from "@/lib/seo";

/** Block types the listing page draws itself. Every other block type is drawn by the block renderer. */
export const LISTING_BUILTIN_TYPES = ["filters", "listingHeader", "listingFeed", "districtLinks", "nearbyCities", "relatedCategories"] as const;

export function isListingBuiltin(type: string) {
  return (LISTING_BUILTIN_TYPES as readonly string[]).includes(type);
}

/** Scopes to try for a listing page, most specific first: the exact URL, the category, then the default layout. */
export function listingScopes(path: string, categorySlug: string): string[] {
  const clean = `/${path.split("?")[0].replace(/^\/+|\/+$/g, "")}/`.replace(/\/{2,}/g, "/");
  const scopes: string[] = [];
  if (/^\/[a-zA-Z0-9\-._~/]{1,300}$/.test(clean)) scopes.push(`url:${clean}`);
  if (/^[a-z0-9-]{1,80}$/.test(categorySlug)) scopes.push(`category:${categorySlug}`);
  scopes.push("default");
  return scopes;
}

type Vars = Record<string, string | number | undefined>;

/** The h1. `{h1}` stands for the heading the page already works out (SEO templates and overrides). */
export function listingHeading(template: string | undefined, h1: string, vars: Vars): string {
  const base = (template ?? "").trim();
  if (!base || base === "{h1}") return h1;
  return fillTemplate(base.replace(/\{h1\}/g, h1), vars as SeoVars).replace(/\s+/g, " ").trim() || h1;
}
