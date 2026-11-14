import { randomUUID } from "node:crypto";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { CategoryFieldOption, CategoryFieldSetting } from "@/server/fields/models";
import {
  MAX_CSV_ROWS,
  MAX_OPTIONS_PER_FIELD,
  assertRoomFor,
  csvFirstColumn,
  normalizeOption,
  optionKey,
  pasteLines,
  reviewOptionCells,
  type OptionReview,
} from "@/server/fields/options";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Category, User } from "@/server/models";
import { textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();

/** Stored field types that take a list of options. */
export const CHOICE_TYPES = ["select", "multiselect"] as const;
export const MAX_FILTER_LABEL = 40;
export const MAX_PICKS_LIMIT = 50;

export interface FieldActor {
  email: string;
  roles: string[];
}

interface StoredField {
  key: string;
  type: string;
  label: string;
  options?: string[];
}

/** Options are admin data. Sellers and users are refused here, and the post-ad form only reads them. */
export function requireFieldAdmin(actor: FieldActor): void {
  if (!isAdminRole(actor.roles)) throw new ForbiddenError("Only an admin can change post-ad options");
}

export function isChoiceType(type: string): boolean {
  return (CHOICE_TYPES as readonly string[]).includes(type);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function actorId(email: string): Promise<string | null> {
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user?._id?.toString() ?? null;
}

/** The category and one of its fields. Throws NotFound when either is missing. */
export async function loadField(categorySlug: string, fieldKey: string) {
  await connectDb();
  const category = await Category.findOne({ slug: categorySlug, deletedAt: null });
  if (!category) throw new NotFoundError("Category not found");
  const field = (category.fields ?? []).find((item) => item.key === fieldKey);
  if (!field) throw new NotFoundError("Field not found");
  return { category, field: field as unknown as StoredField };
}

function requireChoice(type: string): void {
  if (!isChoiceType(type)) throw new ValidationError("Options can only be set on a pick-one or pick-many field");
}

/**
 * Copies options the field already had on the category document into the collection. Runs once per field, before the
 * collection is first used. Duplicates are dropped; a clash with a concurrent copy is ignored.
 */
async function ensureMigrated(categorySlug: string, fieldKey: string, legacy: readonly string[]): Promise<void> {
  if (legacy.length === 0) return;
  if (await CategoryFieldOption.exists({ categorySlug, fieldKey })) return;
  const values = reviewOptionCells([...legacy], MAX_OPTIONS_PER_FIELD).values;
  if (values.length === 0) return;
  try {
    await CategoryFieldOption.insertMany(values.map((value, order) => ({ categorySlug, fieldKey, value, valueKey: optionKey(value), order })));
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

/** Writes the collection's values back onto the category field, so the post-ad form and the listing checks read the same list. */
async function mirrorOptions(categorySlug: string, fieldKey: string): Promise<number> {
  const rows = await CategoryFieldOption.find({ categorySlug, fieldKey }).sort({ order: 1 }).select("value").lean();
  const values = rows.map((row) => row.value);
  await Category.updateOne({ slug: categorySlug, deletedAt: null, "fields.key": fieldKey }, { $set: { "fields.$.options": values } });
  return values.length;
}

export interface OptionPage {
  total: number;
  items: Array<{ value: string; order: number }>;
}

/** One page of a field's options for the admin screen. `q` filters by a case-insensitive part of the text. */
export async function listFieldOptions(
  input: { categorySlug: string; fieldKey: string; q?: string; offset?: number; limit?: number },
  actor: FieldActor,
): Promise<OptionPage> {
  requireFieldAdmin(actor);
  const { field } = await loadField(input.categorySlug, input.fieldKey);
  requireChoice(field.type);
  await ensureMigrated(input.categorySlug, input.fieldKey, field.options ?? []);
  const filter: Record<string, unknown> = { categorySlug: input.categorySlug, fieldKey: input.fieldKey };
  const q = normalizeOption(input.q ?? "");
  if (q) filter.valueKey = { $regex: escapeRegex(optionKey(q)) };
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 50)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const [total, rows] = await Promise.all([
    CategoryFieldOption.countDocuments(filter),
    CategoryFieldOption.find(filter).sort({ order: 1 }).skip(offset).limit(limit).select("value order").lean(),
  ]);
  return { total, items: rows.map((row) => ({ value: row.value, order: row.order })) };
}

export interface AddOptionsResult extends OptionReview {
  added: number;
  skipped: number;
  total: number;
}

/** Adds options from a pasted list or a CSV file. Options already in the list are skipped, not repeated. */
export async function addFieldOptions(input: {
  categorySlug: string;
  fieldKey: string;
  text: string;
  source: "paste" | "csv";
  actor: FieldActor;
}): Promise<AddOptionsResult> {
  requireFieldAdmin(input.actor);
  const { category, field } = await loadField(input.categorySlug, input.fieldKey);
  requireChoice(field.type);
  await ensureMigrated(input.categorySlug, input.fieldKey, field.options ?? []);
  const review =
    input.source === "csv" ? reviewOptionCells(csvFirstColumn(input.text), MAX_CSV_ROWS) : reviewOptionCells(pasteLines(input.text));
  if (review.rejected[0]?.line === 0) throw new ValidationError(review.rejected[0].reason);
  const existing = await CategoryFieldOption.find({ categorySlug: input.categorySlug, fieldKey: input.fieldKey }).select("valueKey order").lean();
  const known = new Set(existing.map((row) => row.valueKey));
  const fresh = review.values.filter((value) => !known.has(optionKey(value)));
  assertRoomFor(existing.length, fresh.length);
  const start = existing.reduce((highest, row) => Math.max(highest, row.order), -1) + 1;
  if (fresh.length > 0) {
    try {
      await CategoryFieldOption.insertMany(
        fresh.map((value, index) => ({ categorySlug: input.categorySlug, fieldKey: input.fieldKey, value, valueKey: optionKey(value), order: start + index })),
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ValidationError("Options were changed at the same time. Refresh the page and try again.");
      }
      throw error;
    }
  }
  const total = await mirrorOptions(input.categorySlug, input.fieldKey);
  await audit.append({
    actorId: await actorId(input.actor.email),
    actorType: "admin",
    action: "category.field.options.add",
    targetType: "category",
    targetId: String(category._id),
    before: { fieldKey: input.fieldKey, count: existing.length },
    after: { fieldKey: input.fieldKey, count: total, source: input.source, added: fresh.length, addedSample: fresh.slice(0, 50) },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { ...review, added: fresh.length, skipped: review.values.length - fresh.length, total };
}

/** Removes one option from the list. Ads that already use it keep their value. */
export async function removeFieldOption(input: { categorySlug: string; fieldKey: string; value: string; actor: FieldActor }) {
  requireFieldAdmin(input.actor);
  const { category, field } = await loadField(input.categorySlug, input.fieldKey);
  requireChoice(field.type);
  const value = normalizeOption(input.value);
  const result = await CategoryFieldOption.deleteOne({ categorySlug: input.categorySlug, fieldKey: input.fieldKey, valueKey: optionKey(value) });
  if (result.deletedCount === 0) throw new NotFoundError("That option is not in the list");
  const total = await mirrorOptions(input.categorySlug, input.fieldKey);
  await audit.append({
    actorId: await actorId(input.actor.email),
    actorType: "admin",
    action: "category.field.options.remove",
    targetType: "category",
    targetId: String(category._id),
    before: { fieldKey: input.fieldKey, value },
    after: { fieldKey: input.fieldKey, count: total },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { total };
}

/** Replaces the whole list with the values given. Refuses an empty list. */
export async function replaceFieldOptions(input: { categorySlug: string; fieldKey: string; values: readonly string[]; actor: FieldActor }) {
  requireFieldAdmin(input.actor);
  const { category, field } = await loadField(input.categorySlug, input.fieldKey);
  requireChoice(field.type);
  const review = reviewOptionCells([...input.values], MAX_OPTIONS_PER_FIELD);
  const first = review.rejected[0];
  if (first) throw new ValidationError(first.line ? `Option ${first.line}: ${first.reason}` : first.reason);
  if (review.values.length === 0) throw new ValidationError("Add at least one option");
  assertRoomFor(0, review.values.length);
  const before = await CategoryFieldOption.countDocuments({ categorySlug: input.categorySlug, fieldKey: input.fieldKey });
  await CategoryFieldOption.deleteMany({ categorySlug: input.categorySlug, fieldKey: input.fieldKey });
  await CategoryFieldOption.insertMany(
    review.values.map((value, order) => ({ categorySlug: input.categorySlug, fieldKey: input.fieldKey, value, valueKey: optionKey(value), order })),
  );
  const total = await mirrorOptions(input.categorySlug, input.fieldKey);
  await audit.append({
    actorId: await actorId(input.actor.email),
    actorType: "admin",
    action: "category.field.options.replace",
    targetType: "category",
    targetId: String(category._id),
    before: { fieldKey: input.fieldKey, count: before },
    after: { fieldKey: input.fieldKey, count: total },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { total };
}

/** The filter name and pick limit of each field of a category, keyed by field key. */
export async function readFieldSettings(categorySlug: string): Promise<Map<string, { filterLabel: string; maxPicks: number | null }>> {
  const rows = await CategoryFieldSetting.find({ categorySlug }).select("fieldKey filterLabel maxPicks").lean();
  return new Map(rows.map((row) => [row.fieldKey, { filterLabel: row.filterLabel ?? "", maxPicks: row.maxPicks ?? null }]));
}

export function checkFilterLabel(raw: string): string {
  const label = normalizeOption(raw);
  if (label.length > MAX_FILTER_LABEL) throw new ValidationError(`The filter name can be at most ${MAX_FILTER_LABEL} characters`);
  if (label && textDenied(label).denied) throw new ValidationError("The filter name contains a term that is not allowed on Tharkoo");
  return label;
}

/** The most a user may pick. Only pick-many fields take a limit; for other types the result is null. */
export function checkMaxPicks(raw: unknown, type: string): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (type !== "multiselect") return null;
  const picks = Number(raw);
  if (!Number.isInteger(picks) || picks < 1 || picks > MAX_PICKS_LIMIT) {
    throw new ValidationError(`Most picks must be a whole number from 1 to ${MAX_PICKS_LIMIT}`);
  }
  return picks;
}

/** Saves the filter name and pick limit of one field. Admin only. */
export async function saveFieldSettings(input: { categorySlug: string; fieldKey: string; filterLabel: string; maxPicks: unknown; actor: FieldActor }) {
  requireFieldAdmin(input.actor);
  const { field } = await loadField(input.categorySlug, input.fieldKey);
  const filterLabel = checkFilterLabel(input.filterLabel);
  const maxPicks = checkMaxPicks(input.maxPicks, field.type);
  await CategoryFieldSetting.updateOne({ categorySlug: input.categorySlug, fieldKey: input.fieldKey }, { $set: { filterLabel, maxPicks } }, { upsert: true });
  return { filterLabel, maxPicks };
}
