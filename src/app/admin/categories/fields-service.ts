import { randomUUID } from "node:crypto";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Category, User } from "@/server/models";
import { fieldDefinitionListSchema } from "@/server/shared/fields";
import { textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();

/** What the editor may change on a field. Key and type stay as they are; everything else on the field is kept. */
export interface FieldEdit {
  key: string;
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
  options: string[];
}

function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === "object") for (const item of Object.values(value)) yield* strings(item);
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Applies the edits to a category's current fields and validates the result with the existing field schema
 * (`fieldDefinitionListSchema`). The set of fields and their types cannot change here. Order = order of `edits`.
 * Pure: touches no database. Throws ValidationError with a readable message.
 */
export function applyFieldEdits(current: readonly Record<string, unknown>[], edits: readonly FieldEdit[]) {
  if (!Array.isArray(edits)) throw new ValidationError("Fields must be a list");
  const byKey = new Map(current.map((field) => [String(field.key), field]));
  const editKeys = edits.map((edit) => String(edit?.key));
  if (editKeys.length !== byKey.size || new Set(editKeys).size !== byKey.size || editKeys.some((key) => !byKey.has(key))) {
    throw new ValidationError("Fields can be edited and reordered here, but not added or removed");
  }
  const next = edits.map((edit, index) => {
    const base = byKey.get(String(edit.key)) as Record<string, unknown>;
    const isChoice = base.type === "select" || base.type === "multiselect";
    return {
      ...base,
      label: edit.label,
      help: edit.help ?? "",
      placeholder: edit.placeholder ?? "",
      required: edit.required === true,
      options: isChoice ? edit.options : (base.options ?? []),
      order: index,
    };
  });
  // Keys cannot be changed here, and seeded fields such as "work-mode" predate the key pattern, so the schema checks everything except the key.
  const parsed = fieldDefinitionListSchema.safeParse(next.map((field, index) => ({ ...field, key: `f${index}` })));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const [index, name] = issue?.path ?? [];
    const label = typeof index === "number" ? String(next[index]?.label ?? `Field ${index + 1}`) : "Fields";
    throw new ValidationError(`${label}${typeof name === "string" ? ` (${name})` : ""}: ${issue?.message ?? "is invalid"}`);
  }
  for (const text of strings(parsed.data)) {
    if (textDenied(text).denied) throw new ValidationError("A field contains a term that is not allowed on Tharkoo. Change the wording and save again.");
  }
  return parsed.data.map((field, index) => ({ ...field, key: String(edits[index].key) }));
}

async function actorId(email: string) {
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user?._id?.toString() ?? null;
}

/** Saves one category's post-form fields. Admin or superadmin only; audited with before and after. */
export async function updateCategoryFields(input: { slug: string; edits: unknown; email: string; roles: string[] }) {
  if (!isAdminRole(input.roles)) throw new ForbiddenError("Only an admin can edit post fields");
  await connectDb();
  const category = await Category.findOne({ slug: input.slug, deletedAt: null });
  if (!category) throw new NotFoundError("Category not found");
  const before = plain(category.fields ?? []) as unknown as Record<string, unknown>[];
  const fields = applyFieldEdits(before, input.edits as FieldEdit[]);
  category.set("fields", fields);
  await category.save();
  await audit.append({
    actorId: await actorId(input.email),
    actorType: "admin",
    action: "category.fields.update",
    targetType: "category",
    targetId: String(category._id),
    before: { slug: input.slug, fields: before },
    after: { slug: input.slug, fields },
    requestId: randomUUID(),
  });
  await refreshPublicCache();
  return { fields };
}

/** The fields an editor starts from. */
export async function readCategoryFields(slug: string) {
  await connectDb();
  const category = await Category.findOne({ slug, deletedAt: null }).lean();
  if (!category) return null;
  const fields = plain(category.fields ?? []) as unknown as Record<string, unknown>[];
  return { name: String(category.name), fields: [...fields].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)) };
}
