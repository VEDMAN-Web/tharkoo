import { Category } from "@/server/models";
import { CATEGORY_KINDS, type CategoryKind } from "@/server/models/catalog";

/**
 * Slugs that are people listings (dating, friendship, personals and similar). Live video tours can never be on for them.
 * wellness and meetups are included on purpose: when unsure, fail closed.
 */
export const PEOPLE_SLUGS = ["dating", "friendship", "meetups", "personal-ads", "personals", "wellness"] as const;

/** The kind of each seeded category. Admin-created categories must choose one; there is no default. */
export const KIND_BY_SLUG: Record<string, CategoryKind> = {
  dating: "people",
  friendship: "people",
  meetups: "people",
  "personal-ads": "people",
  personals: "people",
  wellness: "people",
  jobs: "job",
  property: "property",
  vehicles: "vehicle",
  "buy-and-sell": "goods",
  pets: "goods",
  education: "service",
};

export function isCategoryKind(value: unknown): value is CategoryKind {
  return typeof value === "string" && (CATEGORY_KINDS as readonly string[]).includes(value);
}

/** An age-gate field: a field keyed "age" whose minimum is 18 or more. Such a category is treated as people. */
export function hasAgeGate(fields: unknown): boolean {
  if (!Array.isArray(fields)) return false;
  return fields.some((field) => {
    const row = field as { key?: unknown; min?: unknown };
    return row.key === "age" && typeof row.min === "number" && row.min >= 18;
  });
}

/** The kind a category should have, from its slug or its age-gate field. Null when nothing says so. */
export function kindFor(slug: string, fields: unknown): CategoryKind | null {
  if ((PEOPLE_SLUGS as readonly string[]).includes(slug)) return "people";
  if (hasAgeGate(fields)) return "people";
  return KIND_BY_SLUG[slug] ?? null;
}

interface RawCategory {
  _id: unknown;
  slug?: string;
  kind?: unknown;
  fields?: unknown;
  videoTourEnabled?: boolean;
}

/**
 * Sets kinds on existing categories. Idempotent: running it again changes nothing.
 * People categories are forced to kind "people" and have their tour switch turned off, even if a superadmin had turned it on.
 * Other categories only get a kind when they have none. Categories that still have no kind are listed for an admin to set.
 */
export async function repairCategoryKinds(): Promise<{ updated: number; withoutKind: string[] }> {
  const rows = (await Category.collection
    .find({}, { projection: { slug: 1, kind: 1, fields: 1, videoTourEnabled: 1 } })
    .toArray()) as unknown as RawCategory[];
  let updated = 0;
  const withoutKind: string[] = [];
  for (const row of rows) {
    const slug = row.slug ?? "";
    const wanted = kindFor(slug, row.fields);
    const current = isCategoryKind(row.kind) ? row.kind : null;
    if (wanted === "people") {
      const set: Record<string, unknown> = {};
      if (current !== "people") set.kind = "people";
      if (row.videoTourEnabled) set.videoTourEnabled = false;
      if (Object.keys(set).length) {
        await Category.collection.updateOne({ _id: row._id as never }, { $set: set });
        updated += 1;
      }
      continue;
    }
    if (!current && wanted) {
      await Category.collection.updateOne({ _id: row._id as never }, { $set: { kind: wanted } });
      updated += 1;
      continue;
    }
    if (!current) withoutKind.push(slug);
  }
  return { updated, withoutKind };
}
