import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { isPeopleListing, listKinds, type KindView } from "@/server/categories/kinds";
import { picturesOf, type PicturesView } from "@/server/layout/catalog-pictures";
import { Category, Listing } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";

/** Everything the Categories & fields screen shows, for the category the address names (or the first one). */

export type CategoryRowView = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  ads: number;
  fieldCount: number;
  thumb: string;
};

export type CategoryDetailView = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  kind: string;
  icon: string;
  importMaxPhotos: number | null;
  seoIntro: string;
  homeLine: string;
  pictures: PicturesView;
  adCount: number;
  /** A people listing behaves as People whatever kind it has, and never allows video. */
  peopleLocked: boolean;
  subs: { id: string; slug: string; name: string; icon: string; enabled: boolean; seoIntro: string }[];
};

export type CategoriesScreenData = {
  rows: CategoryRowView[];
  detail: CategoryDetailView | null;
  kinds: KindView[];
  /** True when the address named a category; false when the first one is shown by default. */
  chosen: boolean;
};

type Lean = {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  enabled?: boolean;
  kind?: string;
  icon?: string;
  importMaxPhotos?: number | null;
  introHtml?: string;
  description?: string;
  fields?: unknown[];
  photo?: never;
  band?: never;
};

export async function loadCategoriesScreen(slug: string): Promise<CategoriesScreenData> {
  await connectDb();
  const kinds = await listKinds();
  const docs = await Category.find({ deletedAt: null }).select("slug name enabled kind icon importMaxPhotos introHtml description fields photo band").sort({ order: 1, name: 1 }).lean();
  const views = await picturesOf(docs as never);
  const counts = await Listing.aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: "$categoryId", n: { $sum: 1 } } }]);
  const adsBy = new Map(counts.map((row) => [String(row._id), row.n]));
  const rows: CategoryRowView[] = docs.map((doc, index) => ({
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    enabled: doc.enabled !== false,
    ads: adsBy.get(String(doc._id)) ?? 0,
    fieldCount: (doc as unknown as Lean).fields?.length ?? 0,
    thumb: views[index].photo?.image.src ?? "",
  }));
  const at = docs.findIndex((doc) => doc.slug === slug);
  const index = at >= 0 ? at : 0;
  const doc = docs[index] as unknown as Lean | undefined;
  if (!doc) return { rows, detail: null, kinds, chosen: false };
  const subRows = await Subcategory.find({ categoryId: doc._id }).sort({ order: 1, name: 1 }).lean();
  return {
    rows,
    kinds,
    chosen: at >= 0,
    detail: {
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      enabled: doc.enabled !== false,
      kind: doc.kind ?? "",
      icon: doc.icon ?? "",
      importMaxPhotos: doc.importMaxPhotos ?? null,
      seoIntro: doc.introHtml ?? "",
      homeLine: doc.description ?? "",
      pictures: views[index],
      adCount: adsBy.get(String(doc._id)) ?? 0,
      peopleLocked: isPeopleListing(doc),
      subs: subRows.map((row) => ({ id: String(row._id), slug: row.slug, name: row.name, icon: row.icon ?? "", enabled: row.enabled !== false, seoIntro: row.seoIntro ?? "" })),
    },
  };
}
