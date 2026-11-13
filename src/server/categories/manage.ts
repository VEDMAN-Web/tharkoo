import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { validateSlug } from "@/lib/urls";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Category, Listing, User } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { textDenied } from "@/server/shared/policy";
import { renameCategory } from "@/server/urls/service";

const audit = new AuditRepository();
const MAX_NAME = 80;
const MAX_INTRO = 600;
const MAX_ICON = 40;

export interface Actor {
  email: string;
  roles: string[];
}

export interface CategoryInput {
  name?: string;
  slug?: string;
  order?: number;
  enabled?: boolean;
  seoIntro?: string;
}

export interface SubcategoryInput extends CategoryInput {
  categoryId?: string;
  icon?: string;
}

function requireAdmin(actor: Actor) {
  if (!isAdminRole(actor.roles)) throw new ForbiddenError("Only an admin can edit categories");
}

function cleanText(value: unknown, label: string, max: number, required: boolean) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw new ValidationError(`${label} is required`);
  if (text.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer`);
  if (text && textDenied(text).denied) throw new ValidationError(`${label} contains a term that is not allowed on Tharkoo`);
  return text;
}

function cleanOrder(value: unknown) {
  const order = Number(value ?? 0);
  if (!Number.isFinite(order) || order < -9999 || order > 9999) throw new ValidationError("Order must be a number between -9999 and 9999");
  return Math.trunc(order);
}

function cleanSlug(value: string) {
  const parsed = validateSlug(value);
  if (!parsed.ok) throw new ValidationError(parsed.message);
  return parsed.slug;
}

function objectId(id: string, what: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError(`${what} not found`);
  return new Types.ObjectId(id);
}

async function record(actor: Actor, action: string, targetType: string, id: string, before: unknown, after: unknown) {
  const user = actor.email ? await User.findOne({ email: actor.email }).select("_id") : null;
  await audit.append({
    actorId: user?._id?.toString() ?? null,
    actorType: "admin",
    action,
    targetType,
    targetId: id,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    requestId: randomUUID(),
  });
}

/** Ads in every state count, so a category or sub-category with any ad cannot be removed. */
export function categoryAdCount(categoryId: Types.ObjectId) {
  return Listing.countDocuments({ categoryId });
}

export function subcategoryAdCount(subcategoryId: Types.ObjectId) {
  return Listing.countDocuments({ subcategoryId });
}

export async function createCategory(actor: Actor, input: CategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const name = cleanText(input.name, "Name", MAX_NAME, true);
  const slug = cleanSlug(input.slug || name);
  if (await Category.exists({ slug })) throw new ValidationError("That slug is already used");
  const doc = await Category.create({
    slug,
    name,
    order: cleanOrder(input.order),
    enabled: input.enabled !== false,
    introHtml: cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false),
  });
  await record(actor, "category.create", "category", String(doc._id), null, { slug, name });
  await refreshPublicCache();
  return { id: String(doc._id) };
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Category.findById(objectId(id, "Category"));
  if (!doc || doc.deletedAt) throw new NotFoundError("Category not found");
  const before = { slug: doc.slug, name: doc.name, order: doc.order, enabled: doc.enabled, seoIntro: doc.introHtml };
  if (input.name !== undefined) doc.name = cleanText(input.name, "Name", MAX_NAME, true);
  if (input.order !== undefined) doc.order = cleanOrder(input.order);
  if (input.enabled !== undefined) doc.enabled = Boolean(input.enabled);
  if (input.seoIntro !== undefined) doc.introHtml = cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false);
  await doc.save();
  if (input.slug !== undefined && input.slug !== doc.slug) {
    try {
      await renameCategory(id, cleanSlug(input.slug));
    } catch (error) {
      throw error instanceof ValidationError ? error : new ValidationError(error instanceof Error ? error.message : "Slug could not be changed");
    }
  }
  const after = await Category.findById(doc._id).lean();
  await record(actor, "category.update", "category", id, before, {
    slug: after?.slug,
    name: after?.name,
    order: after?.order,
    enabled: after?.enabled,
    seoIntro: after?.introHtml,
  });
  await refreshPublicCache();
  return { ok: true as const };
}

/** A category with ads is never removed: hide it instead. An empty category takes its sub-categories with it. */
export async function deleteCategory(actor: Actor, id: string) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Category.findById(objectId(id, "Category")).lean();
  if (!doc) throw new NotFoundError("Category not found");
  if ((await categoryAdCount(doc._id)) > 0) throw new ValidationError("This category has ads. Hide it instead of removing it.");
  await Subcategory.deleteMany({ categoryId: doc._id });
  await Category.deleteOne({ _id: doc._id });
  await record(actor, "category.delete", "category", id, { slug: doc.slug, name: doc.name }, null);
  await refreshPublicCache();
  return { ok: true as const };
}

export async function createSubcategory(actor: Actor, input: SubcategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const category = await Category.findOne({ _id: objectId(input.categoryId ?? "", "Category"), deletedAt: null }).select("_id").lean();
  if (!category) throw new ValidationError("Pick the category this sub-category belongs to");
  const name = cleanText(input.name, "Name", MAX_NAME, true);
  const slug = cleanSlug(input.slug || name);
  if (await Subcategory.exists({ categoryId: category._id, slug })) throw new ValidationError("That slug is already used in this category");
  const doc = await Subcategory.create({
    categoryId: category._id,
    slug,
    name,
    icon: cleanText(input.icon, "Icon", MAX_ICON, false),
    order: cleanOrder(input.order),
    enabled: input.enabled !== false,
    seoIntro: cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false),
  });
  await record(actor, "subcategory.create", "subcategory", String(doc._id), null, { slug, name, categoryId: String(category._id) });
  await refreshPublicCache();
  return { id: String(doc._id) };
}

export async function updateSubcategory(actor: Actor, id: string, input: SubcategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Subcategory.findById(objectId(id, "Sub-category"));
  if (!doc) throw new NotFoundError("Sub-category not found");
  const before = { slug: doc.slug, name: doc.name, icon: doc.icon, order: doc.order, enabled: doc.enabled, seoIntro: doc.seoIntro };
  if (input.name !== undefined) doc.name = cleanText(input.name, "Name", MAX_NAME, true);
  if (input.icon !== undefined) doc.icon = cleanText(input.icon, "Icon", MAX_ICON, false);
  if (input.order !== undefined) doc.order = cleanOrder(input.order);
  if (input.enabled !== undefined) doc.enabled = Boolean(input.enabled);
  if (input.seoIntro !== undefined) doc.seoIntro = cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false);
  if (input.slug !== undefined && input.slug !== doc.slug) {
    const slug = cleanSlug(input.slug);
    if (await Subcategory.exists({ categoryId: doc.categoryId, slug, _id: { $ne: doc._id } })) {
      throw new ValidationError("That slug is already used in this category");
    }
    doc.oldSlugs = [...new Set([...(doc.oldSlugs ?? []).filter((old) => old !== slug), doc.slug])];
    doc.slug = slug;
  }
  await doc.save();
  await record(actor, "subcategory.update", "subcategory", id, before, {
    slug: doc.slug,
    name: doc.name,
    icon: doc.icon,
    order: doc.order,
    enabled: doc.enabled,
    seoIntro: doc.seoIntro,
  });
  await refreshPublicCache();
  return { ok: true as const };
}

/** Removing a sub-category that still has ads is blocked: hide it instead. */
export async function deleteSubcategory(actor: Actor, id: string) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Subcategory.findById(objectId(id, "Sub-category")).lean();
  if (!doc) throw new NotFoundError("Sub-category not found");
  if ((await subcategoryAdCount(doc._id)) > 0) throw new ValidationError("This sub-category has ads. Hide it instead of removing it.");
  await Subcategory.deleteOne({ _id: doc._id });
  await record(actor, "subcategory.delete", "subcategory", id, { slug: doc.slug, name: doc.name }, null);
  await refreshPublicCache();
  return { ok: true as const };
}

/** Saves a drag-and-drop order: the position in `ids` becomes the order. */
export async function reorder(actor: Actor, kind: "category" | "subcategory", ids: string[]) {
  requireAdmin(actor);
  await connectDb();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || new Set(ids).size !== ids.length) throw new ValidationError("Nothing to reorder");
  const objectIds = ids.map((id) => objectId(id, "Item"));
  const ops = objectIds.map((_id, index) => ({ updateOne: { filter: { _id }, update: { $set: { order: index } } } }));
  if (kind === "category") {
    if ((await Category.countDocuments({ _id: { $in: objectIds } })) !== ids.length) throw new NotFoundError("One of the items no longer exists");
    await Category.bulkWrite(ops);
  } else {
    if ((await Subcategory.countDocuments({ _id: { $in: objectIds } })) !== ids.length) throw new NotFoundError("One of the items no longer exists");
    await Subcategory.bulkWrite(ops);
  }
  await record(actor, `${kind}.reorder`, kind, ids[0], null, { ids });
  await refreshPublicCache();
  return { ok: true as const };
}
