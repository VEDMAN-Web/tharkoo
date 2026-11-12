import { cached, refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { missingSchemaFields, type AdSchemaMapping, type ListingSchemaInput } from "@/lib/seo/schema";
import { ValidationError } from "@/server/http";
import { Listing } from "@/server/models";
import { Site } from "@/server/models/cms";
import { assertSeoEditor, assertSuperadmin, recordSeo, type SeoActor } from "@/app/admin/seo/staff";
import { normaliseSeoSettings, validateSeoSettings, type SeoSettings } from "./rules";

export async function getSeoSettings(): Promise<SeoSettings> {
  return cached(
    "seo-settings",
    30_000,
    async () => {
      await connectDb();
      const site = await Site.findOne({ key: "default" }).select("seoSettings").lean<{ seoSettings?: unknown } | null>();
      return normaliseSeoSettings(site?.seoSettings);
    },
    ["site"],
  );
}

/** Saves the settings. Extra robots lines can only be changed by a superadmin. */
export async function saveSeoSettings(actor: SeoActor, raw: unknown) {
  assertSeoEditor(actor);
  const checked = validateSeoSettings(raw);
  if (!checked.ok) throw new ValidationError("Check the highlighted fields", checked.errors);
  await connectDb();
  const stored = await Site.findOne({ key: "default" }).select("seoSettings").lean<{ seoSettings?: unknown } | null>();
  const before = normaliseSeoSettings(stored?.seoSettings);
  if (JSON.stringify(before.robotsDisallow) !== JSON.stringify(checked.value.robotsDisallow)) assertSuperadmin(actor);
  await Site.updateOne({ key: "default" }, { $set: { seoSettings: checked.value } }, { upsert: true });
  await refreshPublicCache();
  await recordSeo(actor, "seo.settings.save", "site", "default", before, checked.value);
  return checked.value;
}

export interface SkippedAd {
  slug: string;
  title: string;
  missing: string[];
}

const CHECK_LIMIT = 300;

function priceOf(row: { price?: number; attributes?: unknown }) {
  if (typeof row.price === "number" && row.price > 0) return row.price;
  const bag = row.attributes && typeof row.attributes === "object" ? (row.attributes as Record<string, unknown>) : {};
  for (const key of ["price", "rent", "salary"]) {
    const value = Number(bag[key]);
    if (value > 0) return value;
  }
  return null;
}

function textOf(bag: unknown, key: string) {
  const value = bag && typeof bag === "object" ? (bag as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Live ads of one category that the chosen schema type would skip, with what each is missing. */
export async function adsSkippedBySchema(categoryId: string, mapping: AdSchemaMapping): Promise<{ checked: number; skipped: SkippedAd[] }> {
  if (mapping === "none") return { checked: 0, skipped: [] };
  await connectDb();
  const rows = await Listing.find({ categoryId, status: "active" })
    .select("slug title description attributes price publishedAt expiresAt")
    .sort({ publishedAt: -1 })
    .limit(CHECK_LIMIT)
    .lean<{ slug?: string; title?: string; description?: string; attributes?: unknown; price?: number; publishedAt?: Date; expiresAt?: Date }[]>();
  const skipped: SkippedAd[] = [];
  for (const row of rows) {
    const input: ListingSchemaInput = {
      category: "",
      name: row.title ?? "",
      description: row.description ?? "",
      url: "",
      price: priceOf(row),
      datePosted: row.publishedAt ? new Date(row.publishedAt).toISOString() : undefined,
      validThrough: row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined,
      hiringOrganization: textOf(row.attributes, "company") ?? textOf(row.attributes, "hiringOrganization"),
      jobLocation: "set",
    };
    const missing = missingSchemaFields(mapping, input);
    if (missing.length) skipped.push({ slug: row.slug ?? "", title: row.title ?? "", missing });
  }
  return { checked: rows.length, skipped };
}
