import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Category, Listing, Location } from "@/server/models";
import { Subcategory, type SubcategoryDoc } from "@/server/models/subcategory";
import { presentRows } from "@/server/search/query";

/** A sub-category page is indexable only with at least this many real active ads. */
export const SUBCATEGORY_HUB_MINIMUM = 5;
export const SUBCATEGORY_PAGE_SIZE = 20;

export interface SubcategoryView {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  icon: string;
  order: number;
  enabled: boolean;
  seoIntro: string;
}

type SubRow = SubcategoryDoc & { _id: Types.ObjectId };

function view(row: SubRow): SubcategoryView {
  return {
    id: String(row._id),
    categoryId: String(row.categoryId),
    slug: row.slug,
    name: row.name,
    icon: row.icon ?? "",
    order: row.order ?? 0,
    enabled: row.enabled !== false,
    seoIntro: row.seoIntro ?? "",
  };
}

/** Sub-categories of one category in the admin's order. Hidden ones only when asked for. */
export async function listSubcategories(categoryId: string, options: { includeHidden?: boolean } = {}) {
  if (!Types.ObjectId.isValid(categoryId)) return [];
  await connectDb();
  const filter: Record<string, unknown> = { categoryId: new Types.ObjectId(categoryId) };
  if (!options.includeHidden) filter.enabled = { $ne: false };
  const rows = await Subcategory.find(filter).sort({ order: 1, name: 1 }).lean<SubRow[]>();
  return rows.map(view);
}

/** Every category's visible sub-categories at once, for the post form. */
export async function subcategoriesByCategory() {
  await connectDb();
  const rows = await Subcategory.find({ enabled: { $ne: false } }).sort({ order: 1, name: 1 }).lean<SubRow[]>();
  const out: Record<string, SubcategoryView[]> = {};
  for (const row of rows) (out[String(row.categoryId)] ??= []).push(view(row));
  return out;
}

/** Finds a sub-category by its slug in a category. An earlier slug answers with `redirectTo`, so old addresses keep working. */
export async function findSubcategory(categoryId: Types.ObjectId | string, slug: string) {
  await connectDb();
  const categoryObject = new Types.ObjectId(String(categoryId));
  const row =
    (await Subcategory.findOne({ categoryId: categoryObject, slug }).lean<SubRow>()) ??
    (await Subcategory.findOne({ categoryId: categoryObject, oldSlugs: slug }).lean<SubRow>());
  if (!row || row.enabled === false) return null;
  return { sub: view(row), redirectTo: row.slug !== slug ? row.slug : null };
}

const ACTIVE = { status: "active", feedHidden: { $ne: true } } as const;

export interface SubcategoryChip {
  slug: string;
  name: string;
  count: number;
  /** City the chip links to: the page's own city, or on a category page the city with the most ads for it. */
  citySlug: string;
}

/** The chips shown on category and city pages: visible sub-categories that have live ads, with their counts. */
export async function subcategoryChips(categorySlug: string, citySlug?: string): Promise<SubcategoryChip[]> {
  await connectDb();
  const category = await Category.findOne({ slug: categorySlug, deletedAt: null }).select("_id").lean();
  if (!category) return [];
  const city = citySlug ? await Location.findOne({ type: "city", slug: citySlug }).select("_id").lean() : null;
  if (citySlug && !city) return [];
  const subs = await listSubcategories(String(category._id));
  if (subs.length === 0) return [];
  const match: Record<string, unknown> = { ...ACTIVE, categoryId: category._id, subcategoryId: { $in: subs.map((sub) => new Types.ObjectId(sub.id)) } };
  if (city) match.cityId = city._id;
  const rows = await Listing.aggregate<{ _id: { s: Types.ObjectId; l?: Types.ObjectId }; n: number }>([
    { $match: match },
    { $group: { _id: { s: "$subcategoryId", l: "$cityId" }, n: { $sum: 1 } } },
  ]);
  const cityRows = city ? [] : await Location.find({ type: "city" }).select("slug").lean<{ _id: Types.ObjectId; slug: string }[]>();
  const cityName = new Map(cityRows.map((row) => [String(row._id), row.slug]));
  const total = new Map<string, number>();
  const top = new Map<string, { n: number; slug: string }>();
  for (const row of rows) {
    const key = String(row._id.s);
    total.set(key, (total.get(key) ?? 0) + row.n);
    const slug = city ? (citySlug as string) : cityName.get(String(row._id.l)) ?? "";
    if (slug && row.n > (top.get(key)?.n ?? 0)) top.set(key, { n: row.n, slug });
  }
  return subs.flatMap((sub) => {
    const count = total.get(sub.id) ?? 0;
    const target = top.get(sub.id)?.slug;
    return count > 0 && target ? [{ slug: sub.slug, name: sub.name, count, citySlug: target }] : [];
  });
}

/** The ads of one sub-category in one city, in the same card shape the other listing pages use. */
export async function subcategoryFeed(input: { categoryId: string; cityId: string; subcategoryId: string; page: number }) {
  await connectDb();
  const filter = {
    ...ACTIVE,
    categoryId: new Types.ObjectId(input.categoryId),
    cityId: new Types.ObjectId(input.cityId),
    subcategoryId: new Types.ObjectId(input.subcategoryId),
  };
  const total = await Listing.countDocuments(filter);
  const page = Math.max(1, input.page);
  const rows = await Listing.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .skip((page - 1) * SUBCATEGORY_PAGE_SIZE)
    .limit(SUBCATEGORY_PAGE_SIZE)
    .lean();
  const presented = await presentRows(rows as unknown as Parameters<typeof presentRows>[0], new Map(), new Date());
  return { items: presented.legacy, total, page, pages: Math.max(1, Math.ceil(total / SUBCATEGORY_PAGE_SIZE)) };
}

/** Indexable only with enough real ads; otherwise noindex and out of the sitemap. */
export function isSubcategoryIndexable(total: number, page = 1, minimum = SUBCATEGORY_HUB_MINIMUM) {
  return page === 1 && total >= minimum;
}

/** Sub-category cities with enough ads to be in the sitemap: [category slug, city slug, sub-category slug] triples. */
export async function indexableSubcategoryHubs(minimum = SUBCATEGORY_HUB_MINIMUM) {
  await connectDb();
  const rows = await Listing.aggregate<{ _id: { c: Types.ObjectId; l: Types.ObjectId; s: Types.ObjectId }; n: number }>([
    { $match: { ...ACTIVE, subcategoryId: { $exists: true, $ne: null }, cityId: { $exists: true } } },
    { $group: { _id: { c: "$categoryId", l: "$cityId", s: "$subcategoryId" }, n: { $sum: 1 } } },
    { $match: { n: { $gte: minimum } } },
  ]);
  if (rows.length === 0) return [];
  const [cats, cities, subs] = await Promise.all([
    Category.find({ enabled: { $ne: false }, deletedAt: null }).select("slug").lean<{ _id: Types.ObjectId; slug: string }[]>(),
    Location.find({ type: "city", enabled: { $ne: false } }).select("slug").lean<{ _id: Types.ObjectId; slug: string }[]>(),
    Subcategory.find({ enabled: { $ne: false } }).select("slug").lean<{ _id: Types.ObjectId; slug: string }[]>(),
  ]);
  const slugOf = (list: { _id: Types.ObjectId; slug: string }[]) => new Map(list.map((row) => [String(row._id), row.slug]));
  const [catSlug, citySlug, subSlug] = [slugOf(cats), slugOf(cities), slugOf(subs)];
  return rows.flatMap((row) => {
    const trio = [catSlug.get(String(row._id.c)), citySlug.get(String(row._id.l)), subSlug.get(String(row._id.s))];
    return trio.every(Boolean) ? [{ category: trio[0] as string, city: trio[1] as string, sub: trio[2] as string, count: row.n }] : [];
  });
}

/**
 * Matches a typed value (slug or name, any case) to a sub-category of a category. For the CSV import and the post form.
 * Returns the id, or null when the category has none or nothing matches.
 */
export async function resolveSubcategory(categoryId: string, value: string) {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return null;
  const subs = await listSubcategories(categoryId, { includeHidden: true });
  return subs.find((sub) => sub.slug === wanted || sub.name.toLowerCase() === wanted)?.id ?? null;
}

/** True when the post form must ask for a sub-category in this category. */
export async function categoryNeedsSubcategory(categoryId: string) {
  return (await listSubcategories(categoryId)).length > 0;
}
