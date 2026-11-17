import { randomUUID } from "node:crypto";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { canEditSite } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { reviewOptionCells } from "@/server/fields/options";
import {
  isChoiceType,
  readFieldSettings,
  replaceFieldOptions,
  saveFieldSettings,
} from "@/server/fields/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Category, User } from "@/server/models";
import { attributeKeyDenied, textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();

export const MAX_FIELDS_PER_CATEGORY = 40;

/**
 * The five kinds an admin can pick in the editor, and the stored type each one becomes.
 * Pick-many and pick-one can be switched between each other; the other kinds keep their type.
 */
export const FIELD_KINDS = {
  chips: "multiselect",
  one: "select",
  range: "range",
  yesno: "boolean",
  text: "text",
} as const;
export type FieldKind = keyof typeof FIELD_KINDS;

/** What the editor may change on a field. The field key stays; the type changes only between the two choice kinds. */
export interface FieldEdit {
  key: string;
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
  /** Complete option list. Only the older callers send it; the editor manages options on its own screen. */
  options?: string[];
  /** "Show on post-ad": the field is in the post-ad form. */
  enabled?: boolean;
  /** "Use as filter": the field is a filter on the listing pages. */
  filterable?: boolean;
  type?: "multiselect" | "select";
  filterLabel?: string;
  maxPicks?: number | null;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireText(value: unknown, max: number, message: string): string {
  const text = typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
  if (text.length === 0 || text.length > max) throw new ValidationError(message);
  return text;
}

/**
 * Applies the edits to a category's current fields. The set of fields cannot change here (see addCategoryField).
 * Order = order of `edits`. Options stay as they are on the field (the mirror of the option collection).
 * Pure: touches no database. Throws ValidationError with a readable message.
 */
export function applyFieldEdits(current: readonly Record<string, unknown>[], edits: readonly FieldEdit[]) {
  if (!Array.isArray(edits)) throw new ValidationError("Fields must be a list");
  const byKey = new Map(current.map((field) => [String(field.key), field]));
  const editKeys = edits.map((edit) => String(edit?.key));
  if (editKeys.length !== byKey.size || new Set(editKeys).size !== byKey.size || editKeys.some((key) => !byKey.has(key))) {
    throw new ValidationError("Fields can be edited and reordered here, but not added or removed");
  }
  return edits.map((edit, index) => {
    const base = byKey.get(String(edit.key)) as Record<string, unknown>;
    const label = requireText(edit.label, 80, `Field ${index + 1}: the label is needed (up to 80 characters)`);
    const help = typeof edit.help === "string" ? edit.help.trim().slice(0, 200) : "";
    const placeholder = typeof edit.placeholder === "string" ? edit.placeholder.trim().slice(0, 120) : "";
    for (const text of [label, help, placeholder]) {
      if (textDenied(text).denied) throw new ValidationError("A field contains a term that is not allowed on Tharkoo. Change the wording and save again.");
    }
    const type = String(base.type);
    const wanted = edit.type ?? type;
    if (wanted !== type && !(isChoiceType(type) && isChoiceType(wanted))) {
      throw new ValidationError(`${label}: only pick-one and pick-many fields can change type`);
    }
    if (Array.isArray(edit.options) && isChoiceType(wanted)) {
      const review = reviewOptionCells(edit.options);
      if (review.rejected.length > 0) {
        throw new ValidationError(`${label}: an option is too long or contains a term that is not allowed on Tharkoo`);
      }
      if (review.values.length === 0) throw new ValidationError(`${label}: add at least one option`);
    }
    const enabled = edit.enabled ?? base.enabled !== false;
    const options = (base.options ?? []) as unknown[];
    if (enabled && isChoiceType(wanted) && options.length === 0) {
      throw new ValidationError(`${label}: add at least one option before it shows on the post-ad form`);
    }
    return {
      ...base,
      key: String(edit.key),
      type: wanted,
      label,
      help,
      placeholder,
      required: edit.required === true,
      enabled,
      filterable: edit.filterable ?? base.filterable === true,
      options: isChoiceType(wanted) ? options : [],
      order: index,
    };
  });
}

function withoutOptions(fields: Record<string, unknown>[]) {
  return fields.map((field) => ({ ...field, options: Array.isArray(field.options) ? `${field.options.length} options` : undefined }));
}

async function actorId(email: string) {
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user?._id?.toString() ?? null;
}

/** Saves one category's post-form fields. Admin or superadmin only; audited with before and after. */
export async function updateCategoryFields(input: { slug: string; edits: unknown; email: string; roles: string[] }) {
  if (!canEditSite(input.roles)) throw new ForbiddenError("Only an admin can edit post fields");
  await connectDb();
  const category = await Category.findOne({ slug: input.slug, deletedAt: null });
  if (!category) throw new NotFoundError("Category not found");
  if (!Array.isArray(input.edits)) throw new ValidationError("Fields must be a list");
  const edits = input.edits as FieldEdit[];
  const actor = { email: input.email, roles: input.roles };
  const before = plain(category.fields ?? []) as unknown as Record<string, unknown>[];
  const settingsBefore = await readFieldSettings(input.slug);
  for (const edit of edits) {
    const base = before.find((field) => String(field.key) === String(edit?.key));
    if (base && Array.isArray(edit.options) && isChoiceType(String(base.type))) {
      await replaceFieldOptions({ categorySlug: input.slug, fieldKey: String(edit.key), values: edit.options, actor });
    }
  }
  const current = await Category.findOne({ slug: input.slug, deletedAt: null });
  if (!current) throw new NotFoundError("Category not found");
  const fields = applyFieldEdits(plain(current.fields ?? []) as unknown as Record<string, unknown>[], edits);
  current.set("fields", fields);
  await current.save();
  for (const edit of edits) {
    const prior = settingsBefore.get(String(edit.key)) ?? { filterLabel: "", maxPicks: null };
    if (edit.filterLabel === undefined && edit.maxPicks === undefined) continue;
    await saveFieldSettings({
      categorySlug: input.slug,
      fieldKey: String(edit.key),
      filterLabel: edit.filterLabel ?? prior.filterLabel,
      maxPicks: edit.maxPicks === undefined ? prior.maxPicks : edit.maxPicks,
      actor,
    });
  }
  await audit.append({
    actorId: await actorId(input.email),
    actorType: "admin",
    action: "category.fields.update",
    targetType: "category",
    targetId: String(category._id),
    before: { slug: input.slug, fields: withoutOptions(before) },
    after: { slug: input.slug, fields: withoutOptions(fields as unknown as Record<string, unknown>[]) },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { fields };
}

/** Adds a field to the end of a category's post-ad form. Admin only. The key is made from the label and kept unique. */
export async function addCategoryField(input: { slug: string; label: string; kind: string; email: string; roles: string[] }) {
  if (!canEditSite(input.roles)) throw new ForbiddenError("Only an admin can add post fields");
  if (!Object.prototype.hasOwnProperty.call(FIELD_KINDS, input.kind)) throw new ValidationError("Choose one of the five field types");
  const label = requireText(input.label, 80, "The field needs a label (up to 80 characters)");
  if (textDenied(label).denied) throw new ValidationError("That label is not allowed on Tharkoo");
  await connectDb();
  const category = await Category.findOne({ slug: input.slug, deletedAt: null });
  if (!category) throw new NotFoundError("Category not found");
  const existing = plain(category.fields ?? []) as unknown as Record<string, unknown>[];
  if (existing.length >= MAX_FIELDS_PER_CATEGORY) throw new ValidationError(`A category can have at most ${MAX_FIELDS_PER_CATEGORY} fields`);
  const key = uniqueKey(label, new Set(existing.map((field) => String(field.key))));
  if (attributeKeyDenied(key).denied) throw new ValidationError("That field name is not allowed on Tharkoo");
  const type = FIELD_KINDS[input.kind as FieldKind];
  const next = [
    ...existing,
    {
      key,
      label,
      type,
      required: false,
      options: [],
      min: null,
      max: null,
      unit: "",
      order: existing.length,
      enabled: false,
      filterable: false,
      shownOnCard: false,
      placeholder: "",
      help: "",
    },
  ];
  category.set("fields", next);
  await category.save();
  await audit.append({
    actorId: await actorId(input.email),
    actorType: "admin",
    action: "category.fields.add",
    targetType: "category",
    targetId: String(category._id),
    before: { slug: input.slug, count: existing.length },
    after: { slug: input.slug, key, type, count: next.length },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { key, type };
}

/** A key made from the label: lower-case letters, digits and underscores, starting with a letter, not already used. */
export function uniqueKey(label: string, taken: ReadonlySet<string>): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  if (!base) base = "field";
  if (!/^[a-z]/.test(base)) base = `f_${base}`.slice(0, 36);
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
  return key;
}

/** The fields an editor starts from, with each field's filter name and pick limit. */
export async function readCategoryFields(slug: string) {
  await connectDb();
  const category = await Category.findOne({ slug, deletedAt: null }).lean();
  if (!category) return null;
  const settings = await readFieldSettings(slug);
  const fields = plain(category.fields ?? []) as unknown as Record<string, unknown>[];
  const merged: Record<string, unknown>[] = fields.map((field) => {
    const setting = settings.get(String(field.key));
    return { ...field, filterLabel: setting?.filterLabel ?? "", maxPicks: setting?.maxPicks ?? null };
  });
  return { name: String(category.name), fields: merged.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)) };
}
