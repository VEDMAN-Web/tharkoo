import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { ValidationError } from "@/server/http";
import { Site } from "@/server/models/cms";
import { assertSeoEditor, recordSeo, type SeoActor } from "@/app/admin/seo/staff";

/** Today's built-in thresholds (a hub needs this many ads before it is indexed). */
export const DEFAULT_HUB_MINIMUM = 3;
export const DEFAULT_DISTRICT_MINIMUM = 10;
/** Used as a minimum so that `isThin(count, NEVER)` is always true: the page is noindex and out of the sitemap. */
export const NEVER = Number.MAX_SAFE_INTEGER;
export const MAX_MINIMUM = 1000;

export interface CategoryIndexing {
  hub?: number | null;
  district?: number | null;
  enabled?: boolean;
}

export interface IndexingSettings {
  /** Site-wide minimum per page type; null keeps the category's own number (default 3 and 10). */
  hub: number | null;
  district: number | null;
  categories: Record<string, CategoryIndexing>;
  /** City slugs switched off: the city hub and its district hubs become noindex and leave the sitemap. */
  offCities: string[];
}

export const DEFAULT_INDEXING: IndexingSettings = { hub: null, district: null, categories: {}, offCities: [] };

const SLUG = /^[a-z0-9-]{1,80}$/;

function minimum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_MINIMUM ? n : null;
}

/** Reads stored settings leniently: anything unusable falls back to today's behaviour. */
export function normaliseIndexing(raw: unknown): IndexingSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const categories: Record<string, CategoryIndexing> = {};
  const rawCategories = (source.categories && typeof source.categories === "object" ? source.categories : {}) as Record<string, Record<string, unknown>>;
  for (const [slug, value] of Object.entries(rawCategories)) {
    if (!SLUG.test(slug) || !value || typeof value !== "object") continue;
    const entry: CategoryIndexing = {};
    const hub = minimum(value.hub);
    const district = minimum(value.district);
    if (hub !== null) entry.hub = hub;
    if (district !== null) entry.district = district;
    if (value.enabled === false) entry.enabled = false;
    if (Object.keys(entry).length) categories[slug] = entry;
  }
  const offCities = Array.isArray(source.offCities) ? [...new Set(source.offCities.filter((slug): slug is string => typeof slug === "string" && SLUG.test(slug)))] : [];
  return { hub: minimum(source.hub), district: minimum(source.district), categories, offCities };
}

/** Strict version for saving: rejects instead of dropping. */
export function validateIndexing(raw: unknown): IndexingSettings {
  const problems: Record<string, string[]> = {};
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const check = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    if (minimum(value) === null) problems[field] = [`Use a whole number from 1 to ${MAX_MINIMUM}, or leave it empty`];
  };
  check("hub", source.hub);
  check("district", source.district);
  const rawCategories = (source.categories && typeof source.categories === "object" ? source.categories : {}) as Record<string, Record<string, unknown>>;
  for (const [slug, value] of Object.entries(rawCategories)) {
    if (!SLUG.test(slug)) problems[`categories.${slug}`] = ["Category is not valid"];
    check(`categories.${slug}.hub`, value?.hub);
    check(`categories.${slug}.district`, value?.district);
  }
  if (source.offCities !== undefined && (!Array.isArray(source.offCities) || source.offCities.some((slug) => typeof slug !== "string" || !SLUG.test(slug)))) {
    problems.offCities = ["City list is not valid"];
  }
  if (Object.keys(problems).length) throw new ValidationError("Check the highlighted fields", problems);
  return normaliseIndexing(raw);
}

export interface CategoryLike {
  slug?: string;
  minListingsIndex?: number;
  minListingsLocality?: number;
}

export function isCategoryOn(settings: IndexingSettings, categorySlug?: string) {
  return !categorySlug || settings.categories[categorySlug]?.enabled !== false;
}

export function isCityOn(settings: IndexingSettings, citySlug?: string) {
  return !citySlug || !settings.offCities.includes(citySlug);
}

/**
 * Minimum ads before a city/state hub is indexed. Order: this category's setting, the site-wide setting,
 * the category's own number, 3. Returns NEVER when the category or the city is switched off.
 */
export function hubMinimum(settings: IndexingSettings, category: CategoryLike, citySlug?: string) {
  if (!isCategoryOn(settings, category.slug) || !isCityOn(settings, citySlug)) return NEVER;
  return settings.categories[category.slug ?? ""]?.hub ?? settings.hub ?? category.minListingsIndex ?? DEFAULT_HUB_MINIMUM;
}

/** Same for district hubs (default 10). */
export function districtMinimum(settings: IndexingSettings, category: CategoryLike, citySlug?: string) {
  if (!isCategoryOn(settings, category.slug) || !isCityOn(settings, citySlug)) return NEVER;
  return settings.categories[category.slug ?? ""]?.district ?? settings.district ?? category.minListingsLocality ?? DEFAULT_DISTRICT_MINIMUM;
}

/** Why the minimum is what it is, for the "why is this URL indexable" box. */
export function offReason(settings: IndexingSettings, categorySlug?: string, citySlug?: string) {
  if (!isCategoryOn(settings, categorySlug)) return "the category is switched off in Indexing rules";
  if (!isCityOn(settings, citySlug)) return "the city is switched off in Indexing rules";
  return null;
}

export async function getIndexing(): Promise<IndexingSettings> {
  return cached(
    "seo-indexing",
    30_000,
    async () => {
      await connectDb();
      const site = await Site.findOne({ key: "default" }).select("seoIndexing").lean<{ seoIndexing?: unknown } | null>();
      return normaliseIndexing(site?.seoIndexing);
    },
    ["site"],
  );
}

export async function saveIndexing(actor: SeoActor, raw: unknown) {
  assertSeoEditor(actor);
  const next = validateIndexing(raw);
  await connectDb();
  const before = await Site.findOne({ key: "default" }).select("seoIndexing").lean<{ seoIndexing?: unknown } | null>();
  await Site.updateOne({ key: "default" }, { $set: { seoIndexing: next } }, { upsert: true });
  const { refreshPublicCache } = await import("@/lib/cache");
  await refreshPublicCache();
  await recordSeo(actor, "seo.indexing.save", "site", "default", normaliseIndexing(before?.seoIndexing), next);
  return next;
}
