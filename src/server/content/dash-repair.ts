import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { Category, Location, PageLayout, PageLayoutRevision, Page, Site, SeoTemplate, UiText, UrlOverride } from "@/server/models";
import { ContentPage, SiteSettings } from "@/server/models/platform";
import { DASH_CHARS } from "@/server/content/dashes";

const audit = new AuditRepository();

/** Em and en dashes, built from character codes (see dashes.ts). */
const DASH_SPLIT = new RegExp("[" + String.fromCharCode(0x2014, 0x2013) + "]");

/** Splits at each dash and trims the pieces, so the separator sits cleanly between the words. */
function replaceDashes(text: string, separator: string) {
  return text.split(DASH_SPLIT).map((piece) => piece.trim()).join(separator);
}

/** Title-like keys get " | " as the separator; body text gets ", ". */
const TITLE_KEY = /title|h1|heading|label|name|seo/i;

type Json = unknown;

/** Only plain objects are walked. ObjectId, Date and other class instances are kept as they are. */
function isPlainObject(value: unknown): value is Record<string, Json> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function replaceIn(value: Json, key: string): Json {
  if (typeof value === "string") {
    if (!DASH_CHARS.test(value)) return value;
    const separator = TITLE_KEY.test(key) ? " | " : ", ";
    return replaceDashes(value, separator);
  }
  if (Array.isArray(value)) return value.map((item) => replaceIn(item, key));
  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    for (const [inner, item] of Object.entries(value as Record<string, Json>)) out[inner] = replaceIn(item, inner);
    return out;
  }
  return value;
}

const CONTENT_COLLECTIONS = [
  Site,
  SiteSettings,
  SeoTemplate,
  Category,
  Location,
  UrlOverride,
  PageLayout,
  PageLayoutRevision,
  UiText,
  ContentPage,
  Page,
] as const;

/**
 * Replaces em and en dashes in stored content (titles, templates, overrides, UI text, home blocks).
 * Idempotent: a second run changes nothing. Only changed top-level fields are written; `_id` is never touched.
 */
export async function repairDashes(requestId: string) {
  await connectDb();
  const counts: Record<string, number> = {};
  for (const model of CONTENT_COLLECTIONS) {
    const name = model.collection.collectionName;
    let changed = 0;
    const rows = (await model.collection.find({}).toArray()) as unknown as Record<string, Json>[];
    for (const row of rows) {
      const set: Record<string, Json> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === "_id") continue;
        const next = replaceIn(value, key);
        if (JSON.stringify(next) !== JSON.stringify(value)) set[key] = next;
      }
      if (Object.keys(set).length === 0) continue;
      await model.collection.updateOne({ _id: row._id as never }, { $set: set });
      changed += 1;
    }
    if (changed) counts[name] = changed;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total > 0) {
    await audit.append({
      actorType: "system",
      action: "content.dashes.repair",
      targetType: "content",
      targetId: "dashes",
      requestId,
      after: { documents: counts },
    });
  }
  return { updated: total, collections: counts };
}
