import { randomUUID } from "node:crypto";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { getSeoFor } from "@/lib/queries";
import { cleanPath } from "@/lib/urls";
import { AuditRepository } from "@/server/audit";
import { Category, ContentItem, ContentRevision, Location, Site, UrlOverride } from "@/server/models";
import type { ContentFields } from "@/server/models/content";

const audit = new AuditRepository();

/** D3: listing copy saved in the old places (per-URL override, Site.landings) becomes one published ContentItem "listingIntro" per page. */
export type D3Source = "url-override" | "site-landing";
type Field = "h1" | "intro" | "faqs" | "title" | "description";
type Faq = { q: string; a: string };
type Texts = { h1?: string; intro?: string; faqs?: Faq[]; title?: string; description?: string };

export interface D3Entry {
  path: string;
  kind: "category" | "place";
  /** Every old source with text for this page. */
  sources: { source: D3Source; texts: Texts }[];
  /** The source that wins today for each field that has text (computed with the current page code order). */
  winners: Partial<Record<Field, D3Source>>;
  /** The record D3 would write, or null. */
  record: ContentFields | null;
  conflicts: string[];
  status: "new" | "exists" | "nothing";
}

export interface D3Plan {
  entries: D3Entry[];
  /** Saved copy on pages that are not a category or city/state page (district pages, others): left alone. */
  skipped: { path: string; why: string }[];
  /** Site.landings keys that match no category and city. */
  unmapped: string[];
  /** Old fields no page reads (Category and Location intro text): listed, never copied. */
  dead: { categories: number; locations: number };
  totals: { urls: number; new: number; exists: number; nothing: number; conflicts: number };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const faqs = (items: { q?: string; a?: string }[] | null | undefined, limit?: number): Faq[] => {
  const rows = (items ?? []).filter((item) => text(item?.q) && text(item?.a)).map((item) => ({ q: text(item.q), a: text(item.a) }));
  return limit ? rows.slice(0, limit) : rows;
};
const pick = (texts: Texts): Texts => {
  const out: Texts = {};
  if (text(texts.h1)) out.h1 = text(texts.h1);
  if (text(texts.intro)) out.intro = text(texts.intro);
  if (texts.faqs && texts.faqs.length) out.faqs = texts.faqs;
  if (text(texts.title)) out.title = text(texts.title);
  if (text(texts.description)) out.description = text(texts.description);
  return out;
};

export function slugOfPath(path: string): string {
  return `listing-${cleanPath(path).split("/").filter(Boolean).join("--")}`;
}

type SiteDoc = { landings?: Record<string, { h1?: string; title?: string; description?: string; intro?: string; faqs?: { q?: string; a?: string }[] }> } | null;

/**
 * Reads the old sources and works out, for every listing page that has saved copy, what D3 would write. Writes nothing.
 * A field keeps the winner of today's page code: on a category page the per-URL text beats Site.landings for the intro and questions,
 * and Site.landings has no say in the heading, title or description; on a city or state page a SEO template heading, title or description
 * would beat Site.landings, so then Site.landings text for that field is not copied and the page is listed under conflicts.
 */
export async function planListingCopyMigration(): Promise<D3Plan> {
  await connectDb();
  const [categories, locations, overrides, site, items] = await Promise.all([
    Category.find({}).select("slug name introHtml faqs").lean<{ slug: string; name: string; introHtml?: string; faqs?: unknown[] }[]>(),
    Location.find({ type: { $in: ["city", "state"] } }).select("slug name type introHtml landingHtml faqs").lean<{ slug: string; name: string; introHtml?: string; landingHtml?: string; faqs?: unknown[] }[]>(),
    UrlOverride.find({}).sort({ path: 1 }).limit(5000).lean<{ path: string; h1?: string; intro?: string; title?: string; description?: string; faq?: { q?: string; a?: string }[] }[]>(),
    Site.findOne({ key: "default" }).select("landings").lean<SiteDoc>(),
    ContentItem.find({ kind: "listingIntro" }).select("path").lean<{ path?: string }[]>(),
  ]);
  const categoryBySlug = new Map(categories.map((row) => [row.slug, row]));
  const categoryByWord = new Map(categories.flatMap((row) => [[row.slug.toLowerCase(), row] as const, [row.name.toLowerCase(), row] as const]));
  const placeBySlug = new Map(locations.map((row) => [row.slug, row]));
  const placeByWord = new Map(locations.flatMap((row) => [[row.slug.toLowerCase(), row] as const, [row.name.toLowerCase(), row] as const]));
  const existing = new Set(items.map((row) => row.path ?? ""));
  const found = new Map<string, D3Entry>();
  const skipped: D3Plan["skipped"] = [];
  const unmapped: string[] = [];
  const entryFor = (path: string, kind: "category" | "place") => {
    let entry = found.get(path);
    if (!entry) {
      entry = { path, kind, sources: [], winners: {}, record: null, conflicts: [], status: "nothing" };
      found.set(path, entry);
    }
    return entry;
  };

  for (const row of overrides) {
    const path = cleanPath(row.path);
    const texts = pick({ h1: row.h1, intro: row.intro, faqs: faqs(row.faq, 8), title: row.title, description: row.description });
    if (!texts.h1 && !texts.intro && !texts.faqs) continue;
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 1 && categoryBySlug.has(parts[0])) entryFor(path, "category").sources.push({ source: "url-override", texts });
    else if (parts.length === 2 && categoryBySlug.has(parts[0]) && placeBySlug.has(parts[1])) entryFor(path, "place").sources.push({ source: "url-override", texts });
    else if (parts.length === 3 && categoryBySlug.has(parts[0]) && placeBySlug.has(parts[1])) skipped.push({ path, why: "District pages are not part of the listing copy resolver yet" });
  }

  for (const [key, value] of Object.entries(site?.landings ?? {})) {
    const [first, second] = key.split("|");
    const category = categoryByWord.get((first ?? "").toLowerCase());
    const texts = pick({ h1: value?.h1, intro: value?.intro, faqs: faqs(value?.faqs), title: value?.title, description: value?.description });
    if (!category || !second || (!texts.h1 && !texts.intro && !texts.faqs && !texts.title && !texts.description)) {
      if (!category || !second) unmapped.push(key);
      continue;
    }
    if (second.toLowerCase() === "india") {
      entryFor(cleanPath(`/${category.slug}/`), "category").sources.push({ source: "site-landing", texts });
      continue;
    }
    const place = placeByWord.get(second.toLowerCase());
    if (!place) unmapped.push(key);
    else entryFor(cleanPath(`/${category.slug}/${place.slug}/`), "place").sources.push({ source: "site-landing", texts });
  }

  for (const entry of found.values()) {
    const seoType = entry.kind === "category" ? "category" : "location";
    const slug = entry.path.split("/").filter(Boolean)[0];
    const seo = await getSeoFor(seoType, slug);
    const by = (source: D3Source) => entry.sources.find((item) => item.source === source)?.texts ?? {};
    const url = by("url-override");
    const landing = by("site-landing");
    const take = (field: Field, ...order: [D3Source, Texts][]) => {
      for (const [source, texts] of order) {
        const value = texts[field];
        if (value !== undefined && (typeof value === "string" ? value !== "" : value.length > 0)) {
          entry.winners[field] = source;
          return value;
        }
      }
      return undefined;
    };
    const place = entry.kind === "place";
    let h1 = take("h1", ["url-override", url], ...(place ? ([["site-landing", landing]] as [D3Source, Texts][]) : []));
    if (place && entry.winners.h1 === "site-landing" && seo?.h1) {
      entry.conflicts.push("A SEO template heading is saved for this page type and would be shown before the Site.landings heading, so that heading was not copied.");
      delete entry.winners.h1;
      h1 = undefined;
    }
    const intro = take("intro", ["url-override", url], ["site-landing", landing]);
    const faq = take("faqs", ["url-override", url], ["site-landing", landing]);
    let title: string | Faq[] | undefined = take("title", ["url-override", url], ...(place ? ([["site-landing", landing]] as [D3Source, Texts][]) : []));
    let description: string | Faq[] | undefined = take("description", ["url-override", url], ...(place ? ([["site-landing", landing]] as [D3Source, Texts][]) : []));
    if (entry.winners.title === "site-landing" && seo?.title) {
      entry.conflicts.push("A SEO template title is saved and would be shown before the Site.landings title, so that title was not copied.");
      delete entry.winners.title;
      title = undefined;
    }
    if (entry.winners.description === "site-landing" && seo?.description) {
      entry.conflicts.push("A SEO template description is saved and would be shown before the Site.landings description, so that description was not copied.");
      delete entry.winners.description;
      description = undefined;
    }
    if (entry.kind === "category" && landing.h1) entry.conflicts.push("Site.landings has a heading for a category page; the page never used it, so it was not copied.");
    if (entry.kind === "category" && (landing.title || landing.description)) entry.conflicts.push("Site.landings has a title or description for a category page; the page never used them, so they were not copied.");
    if (url.intro && landing.intro) entry.conflicts.push("Both the per-URL text and Site.landings have an intro; the per-URL text wins today and is copied.");
    const fields: ContentFields = {
      title: entry.path,
      ...(h1 ? { h1: h1 as string } : {}),
      ...(intro ? { body: intro as string } : {}),
      ...(faq ? { faq: faq as Faq[] } : {}),
      ...(title || description ? { seo: { ...(title ? { title: title as string } : {}), ...(description ? { description: description as string } : {}) } } : {}),
    };
    const has = Boolean(h1 || intro || faq || title || description);
    entry.record = has ? fields : null;
    entry.status = !has ? "nothing" : existing.has(entry.path) ? "exists" : "new";
  }

  const entries = Array.from(found.values()).sort((a, b) => a.path.localeCompare(b.path));
  const dead = {
    categories: categories.filter((row) => text(row.introHtml) || (row.faqs?.length ?? 0) > 0).length,
    locations: locations.filter((row) => text(row.introHtml) || text(row.landingHtml) || (row.faqs?.length ?? 0) > 0).length,
  };
  return {
    entries,
    skipped,
    unmapped,
    dead,
    totals: {
      urls: entries.length,
      new: entries.filter((entry) => entry.status === "new").length,
      exists: entries.filter((entry) => entry.status === "exists").length,
      nothing: entries.filter((entry) => entry.status === "nothing").length,
      conflicts: entries.filter((entry) => entry.conflicts.length > 0).length,
    },
  };
}

/** Writes the new ContentItems (published, version 1, by "D3") and one audit line. An item that already exists for a path is never touched. */
export async function applyListingCopyMigration(plan: D3Plan, actor = "D3") {
  await connectDb();
  let written = 0;
  const now = new Date();
  for (const entry of plan.entries) {
    if (entry.status !== "new" || !entry.record) continue;
    const item = await ContentItem.create({ kind: "listingIntro", slug: slugOfPath(entry.path), path: entry.path, status: "published", draft: entry.record, published: entry.record, version: 1, publishedAt: now, updatedVisibleAt: now, lastEditedBy: actor });
    await ContentRevision.create({ itemId: item._id, version: 1, fields: entry.record, status: "published", by: actor, note: "D3: copied from the old listing copy" });
    written += 1;
  }
  await audit.append({
    actorType: "system",
    action: "content.d3.apply",
    targetType: "content",
    targetId: "listingIntro",
    summary: `D3 copied the listing copy of ${written} ${written === 1 ? "page" : "pages"} into the content editor`,
    after: { written, skipped: plan.skipped.length, unmapped: plan.unmapped.length },
    requestId: randomUUID(),
  });
  if (written > 0) await refreshPublicCache();
  return { written };
}
