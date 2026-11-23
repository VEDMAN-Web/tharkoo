import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { isCategoryIconKey } from "@/lib/category-icons";
import { connectDb } from "@/lib/db";
import { canEditSite } from "@/lib/ui/site-content";
import { validateSlug } from "@/lib/urls";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { isPeopleListing, PEOPLE_KEY, requireKind } from "@/server/categories/kinds";
import { adminWrite, changeSentence, recordAdminChange } from "@/server/admin/write";
import type { AdminCtx } from "@/server/admin/context";
import { picturesOf, setCatalogPictures, type PictureInput, type PicturesView } from "@/server/layout/catalog-pictures";
import { Category, Listing } from "@/server/models";
import type { CategoryKind } from "@/server/models/catalog";
import { Subcategory } from "@/server/models/subcategory";
import { renameCategory } from "@/server/urls/service";

const MAX_NAME = 80;
const MAX_INTRO = 600;
const MAX_HOME_LINE = 160;

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
  /** The short line under the name on the Home tile (stored as the description). */
  description?: string;
  /** Required when a category is created. There is no default kind (H6.5). */
  kind?: string;
  /** H7.4c: a key from lib/category-icons.ts, or empty for the default of the kind. */
  icon?: string;
  /** Photos for an ad made by staff or imported (1 to 30). Blank means the default of 10. */
  importMaxPhotos?: number | string | null;
  /** Needed when the kind changes away from People: the admin has been asked and said yes (H10.1). */
  confirmPeopleOff?: boolean;
}

export interface SubcategoryInput extends CategoryInput {
  categoryId?: string;
  icon?: string;
}

function requireAdmin(actor: Actor) {
  if (!canEditSite(actor.roles)) throw new ForbiddenError("Only an admin can edit categories");
}

function cleanText(value: unknown, label: string, max: number, required: boolean) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw new ValidationError(`${label} is required`);
  if (text.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer`);
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

/** Blank means "use the default" (stored as null). Anything else must be a whole number from 1 to 30. */
export function cleanImportMaxPhotos(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new ValidationError("Max photos must be a whole number from 1 to 30");
  return count;
}


function objectId(id: string, what: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError(`${what} not found`);
  return new Types.ObjectId(id);
}

async function record(actor: Actor, action: string, targetType: string, id: string, before: unknown, after: unknown) {
  const named = (value: unknown) => (value && typeof value === "object" ? ((value as { name?: unknown }).name as string | undefined) : undefined);
  const name = named(after) ?? named(before);
  const verb = action.endsWith(".create") ? "Added" : action.endsWith(".delete") ? "Removed" : action.endsWith(".reorder") ? "Reordered" : "Changed";
  await recordAdminChange(actor, {
    action,
    target: { type: targetType, id, label: name },
    before: before as Record<string, unknown> | null,
    after: after as Record<string, unknown> | null,
    summary: verb === "Reordered" ? `Reordered the ${targetType} list` : changeSentence(verb, targetType, name, before, after),
  });
}

/** Ads in every state count, so a category or sub-category with any ad cannot be removed. */
export async function categoryAdCount(categoryId: Types.ObjectId) {
  await connectDb();
  return Listing.countDocuments({ categoryId });
}

export async function subcategoryAdCount(subcategoryId: Types.ObjectId) {
  await connectDb();
  return Listing.countDocuments({ subcategoryId });
}

/** A new category or sub-category goes to the end of its list unless an order is given. */
async function nextOrder(kind: "category" | "subcategory", categoryId?: Types.ObjectId): Promise<number> {
  const last =
    kind === "category"
      ? await Category.findOne({ deletedAt: null }).sort({ order: -1 }).select("order").lean<{ order?: number } | null>()
      : await Subcategory.findOne({ categoryId }).sort({ order: -1 }).select("order").lean<{ order?: number } | null>();
  return typeof last?.order === "number" ? last.order + 1 : 0;
}

export async function createCategory(actor: Actor, input: CategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const name = cleanText(input.name, "Name", MAX_NAME, true);
  const slug = cleanSlug(input.slug || name);
  const kind = await requireKind(input.kind);
  if (await Category.exists({ slug })) throw new ValidationError("That slug is already used");
  const doc = await Category.create({
    slug,
    name,
    kind,
    icon: isCategoryIconKey(input.icon) ? input.icon : "",
    videoTourEnabled: false,
    order: input.order === undefined ? await nextOrder("category") : cleanOrder(input.order),
    enabled: input.enabled !== false,
    introHtml: cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false),
    description: cleanText(input.description, "Home tile line", MAX_HOME_LINE, false),
  });
  await record(actor, "category.create", "category", String(doc._id), null, { slug, name, kind });
  await refreshPublicCache();
  return { id: String(doc._id), slug };
}

export const PEOPLE_OFF_QUESTION = "This turns off the adults-only check and the no-video rule for this category. Continue?";

/** Changing a category's kind away from People is only done after the admin was asked and said yes. */
function assertPeopleOffConfirmed(from: string | undefined, to: string, confirmed: boolean) {
  if (from === PEOPLE_KEY && to !== PEOPLE_KEY && !confirmed) throw new ValidationError(PEOPLE_OFF_QUESTION);
}

/**
 * Changes only the kind of a category, as one audited write that can be undone for the usual window (H10.1).
 * Away from People needs `confirmPeopleOff`; a people category (by slug or an age field) still counts as people whatever its kind.
 */
export async function changeCategoryKind(ctx: AdminCtx, id: string, kind: unknown, options: { confirmPeopleOff?: boolean } = {}) {
  await connectDb();
  if (!canEditSite(ctx.roles)) throw new ForbiddenError("Only an admin can edit categories");
  const next = await requireKind(kind);
  const current = await Category.findById(objectId(id, "Category")).lean();
  if (!current || current.deletedAt) throw new NotFoundError("Category not found");
  if (current.kind === next) return { changed: false as const, eventId: "" };
  assertPeopleOffConfirmed(current.kind, next, options.confirmPeopleOff === true);
  const restore = { kind: current.kind ?? null, videoTourEnabled: current.videoTourEnabled ?? false };
  const written = await adminWrite<{ id: string }>(ctx, {
    perm: "catalogue.edit",
    action: "category.kind",
    target: { type: "category", id, label: current.name },
    texts: [current.name],
    undo: { kind: "record.restore", windowKey: "edits" },
    before: async () => restore,
    apply: async () => {
      await Category.updateOne({ _id: current._id }, { $set: { kind: next, ...(isPeopleListing({ slug: current.slug, kind: next, fields: current.fields }) ? { videoTourEnabled: false } : {}) } });
      const now = await Category.findById(current._id).select("kind videoTourEnabled").lean();
      const after = { kind: now?.kind ?? null, videoTourEnabled: now?.videoTourEnabled ?? false };
      return { after, result: { id }, summary: `Changed the kind of ${current.name} from ${current.kind ?? "none"} to ${next}`, undoData: { model: "Category", id, restore, unset: [], expect: after } };
    },
  });
  await refreshPublicCache();
  return { changed: true as const, eventId: written.eventId };
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Category.findById(objectId(id, "Category"));
  if (!doc || doc.deletedAt) throw new NotFoundError("Category not found");
  const before = { slug: doc.slug, name: doc.name, order: doc.order, enabled: doc.enabled, seoIntro: doc.introHtml, description: doc.description, importMaxPhotos: doc.importMaxPhotos ?? null };
  if (input.name !== undefined) doc.name = cleanText(input.name, "Name", MAX_NAME, true);
  if (input.importMaxPhotos !== undefined) doc.importMaxPhotos = cleanImportMaxPhotos(input.importMaxPhotos);
  if (input.icon !== undefined) doc.icon = isCategoryIconKey(input.icon) ? input.icon : "";
  if (input.order !== undefined) doc.order = cleanOrder(input.order);
  if (input.enabled !== undefined) doc.enabled = Boolean(input.enabled);
  if (input.seoIntro !== undefined) doc.introHtml = cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false);
  if (input.description !== undefined) doc.description = cleanText(input.description, "Home tile line", MAX_HOME_LINE, false);
  if (input.kind !== undefined) {
    const next = await requireKind(input.kind);
    if (next !== doc.kind) assertPeopleOffConfirmed(doc.kind, next, input.confirmPeopleOff === true);
    doc.kind = next;
  }
  // A people listing can never keep live tours on, whatever kind it has (H6.5, H7.167).
  if (isPeopleListing({ slug: doc.slug, kind: doc.kind, fields: doc.fields })) doc.videoTourEnabled = false;
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
    description: after?.description,
    importMaxPhotos: after?.importMaxPhotos ?? null,
  });
  await refreshPublicCache();
  return { ok: true as const, slug: after?.slug ?? doc.slug };
}

/** Statuses a removal leaves alone: the ad is already off the site. */
const GONE_STATUSES = ["removed", "deleted"] as ("removed" | "deleted")[];

/**
 * H18.3 (Vedant, 21 Nov 2026): an admin may remove a category even when it has ads. Every ad in it (real and sample)
 * is taken off the site in one query (status "removed", the same state an admin removal leaves), then its
 * sub-categories and the category go. One audit entry records how many ads were removed.
 */
export async function deleteCategory(actor: Actor, id: string) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Category.findById(objectId(id, "Category")).lean();
  if (!doc) throw new NotFoundError("Category not found");
  const removed = await Listing.updateMany({ categoryId: doc._id, status: { $nin: GONE_STATUSES } }, { $set: { status: "removed" } });
  await Subcategory.deleteMany({ categoryId: doc._id });
  await Category.deleteOne({ _id: doc._id });
  await record(actor, "category.delete", "category", id, { slug: doc.slug, name: doc.name, adsRemoved: removed.modifiedCount }, null);
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
    icon: isCategoryIconKey(input.icon) ? input.icon : "",
    order: input.order === undefined ? await nextOrder("subcategory", category._id) : cleanOrder(input.order),
    enabled: input.enabled !== false,
    seoIntro: cleanText(input.seoIntro, "SEO intro", MAX_INTRO, false),
  });
  await record(actor, "subcategory.create", "subcategory", String(doc._id), null, { slug, name, categoryId: String(category._id) });
  await refreshPublicCache();
  return { id: String(doc._id), slug };
}

export async function updateSubcategory(actor: Actor, id: string, input: SubcategoryInput) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Subcategory.findById(objectId(id, "Sub-category"));
  if (!doc) throw new NotFoundError("Sub-category not found");
  const before = { slug: doc.slug, name: doc.name, icon: doc.icon, order: doc.order, enabled: doc.enabled, seoIntro: doc.seoIntro };
  if (input.name !== undefined) doc.name = cleanText(input.name, "Name", MAX_NAME, true);
  if (input.icon !== undefined) doc.icon = isCategoryIconKey(input.icon) ? input.icon : "";
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

/** H18.3: removing a sub-category takes its ads off the site too (status "removed"), in one query. */
export async function deleteSubcategory(actor: Actor, id: string) {
  requireAdmin(actor);
  await connectDb();
  const doc = await Subcategory.findById(objectId(id, "Sub-category")).lean();
  if (!doc) throw new NotFoundError("Sub-category not found");
  const removed = await Listing.updateMany({ subcategoryId: doc._id, status: { $nin: GONE_STATUSES } }, { $set: { status: "removed" } });
  await Subcategory.deleteOne({ _id: doc._id });
  await record(actor, "subcategory.delete", "subcategory", id, { slug: doc.slug, name: doc.name, adsRemoved: removed.modifiedCount }, null);
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

export type CategoryPictureItem = { id: string; name: string; sub: string; pictures: PicturesView };

/** Sets or clears the photo and the band of a category. One audited write that can be undone (see catalog-pictures.ts). */
export async function setCategoryPictures(ctx: AdminCtx, id: string, input: PictureInput) {
  await connectDb();
  return setCatalogPictures(ctx, "Category", id, input);
}

/** Every category with its pictures, for the picture editor on Categories and fields. */
export async function categoryPictureItems(): Promise<CategoryPictureItem[]> {
  await connectDb();
  const rows = await Category.find({ deletedAt: null }).select("slug name photo band").sort({ order: 1, name: 1 }).lean();
  const views = await picturesOf(rows);
  return rows.map((row, index) => ({ id: String(row._id), name: row.name, sub: row.slug, pictures: views[index] }));
}
