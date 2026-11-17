import { connectDb } from "@/lib/db";
import { kindMaxPhotos } from "@/server/categories/kinds";
import { listSubcategories } from "@/server/categories/public";
import { adPhotoLimit } from "@/server/listings/admin-create";
import { Category, Location, type CategoryDoc } from "@/server/models";

export const PLACE_TYPES = ["country", "state", "city", "district"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export interface AdFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  min: number | null;
  max: number | null;
  unit: string;
  placeholder: string;
  help: string;
}

export interface AdFormCategory {
  id: string;
  name: string;
  slug: string;
  /** Photos allowed for an ad made here (the category setting, or 10). */
  photoLimit: number;
  subcategories: Array<{ id: string; name: string }>;
  fields: AdFormField[];
}

export interface AdFormPlace {
  id: string;
  type: PlaceType;
  name: string;
  parentId: string | null;
  countryCode: string;
}

export interface AdFormOptions {
  categories: AdFormCategory[];
  places: AdFormPlace[];
}

type FieldRow = NonNullable<CategoryDoc["fields"]>[number];
type CategoryRow = CategoryDoc & { _id: { toString(): string } };
type PlaceRow = { _id: { toString(): string }; type: PlaceType; name: string; parentId?: { toString(): string } | null; countryCode?: string };

function fieldOf(field: FieldRow): AdFormField {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    options: field.options ?? [],
    min: field.min ?? null,
    max: field.max ?? null,
    unit: field.unit ?? "",
    placeholder: field.placeholder ?? "",
    help: field.help ?? "",
  };
}

function visibleFields(fields: CategoryDoc["fields"]): AdFormField[] {
  return (fields ?? [])
    .filter((field) => field.enabled !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(fieldOf);
}

async function categoriesForForm(): Promise<AdFormCategory[]> {
  const rows = (await Category.find({ deletedAt: null, enabled: { $ne: false } }).sort({ order: 1, name: 1 }).lean()) as unknown as CategoryRow[];
  return Promise.all(
    rows.map(async (row) => {
      const id = row._id.toString();
      const subs = await listSubcategories(id);
      return {
        id,
        name: row.name,
        slug: row.slug,
        photoLimit: adPhotoLimit(row.importMaxPhotos ?? (await kindMaxPhotos(row.kind))),
        subcategories: subs.map((sub) => ({ id: sub.id, name: sub.name })),
        fields: visibleFields(row.fields),
      };
    }),
  );
}

async function placesForForm(): Promise<AdFormPlace[]> {
  const rows = (await Location.find({ type: { $in: [...PLACE_TYPES] }, enabled: { $ne: false } })
    .sort({ order: 1, name: 1 })
    .lean()) as unknown as PlaceRow[];
  return rows.map((row) => ({
    id: row._id.toString(),
    type: row.type,
    name: row.name,
    parentId: row.parentId ? row.parentId.toString() : null,
    countryCode: row.countryCode ?? "",
  }));
}

/** Everything the create-ad form needs: the categories with their fields and sub-categories, and every enabled place. */
export async function loadAdFormOptions(): Promise<AdFormOptions> {
  await connectDb();
  return { categories: await categoriesForForm(), places: await placesForForm() };
}
