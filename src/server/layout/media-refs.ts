import type { Model } from "mongoose";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Category, Location, PageLayout } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";

export type MediaUsageKind = "page" | "category" | "place";

export interface MediaUsage {
  /** A page key such as home, or the slug of a category or place. */
  key: string;
  scope: string;
  where: "draft" | "published";
  /** A block id on a page, or the picture slot of a category or place: photo, band or band phone. */
  blockId: string;
  blockType: string;
  kind: MediaUsageKind;
  /** What staff see: the name of the category or place. Empty for a page block. */
  label: string;
}

/**
 * One place that stores media ids (H8.39). Every screen that lets staff pick a library image must be listed here,
 * so "where is this image used" and "delete is refused while it is used" cover every reference.
 */
export interface MediaRef {
  name: string;
  usagesOf(assetId: string): Promise<MediaUsage[]>;
  /** How many places use each of these ids, for "Used in 3 places" on a whole page of images. Ids that are not used are left out. */
  countsAmong(assetIds: string[]): Promise<Map<string, number>>;
}

export function mentions(value: unknown, assetId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => mentions(item, assetId));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.assetId === assetId) return true;
    return Object.values(record).some((item) => mentions(item, assetId));
  }
  return false;
}

function blocksUsing(blocks: BlockBase[] | undefined, assetId: string) {
  return (blocks ?? []).filter((block) => mentions(block.props, assetId));
}

const pages: MediaRef = {
  name: "pages",
  async usagesOf(assetId) {
    await connectDb();
    const out: MediaUsage[] = [];
    for (const doc of await PageLayout.find({}).lean()) {
      for (const [where, blocks] of [["draft", doc.draft], ["published", doc.published]] as const) {
        for (const block of blocksUsing(blocks as BlockBase[], assetId)) {
          out.push({ key: doc.key, scope: doc.scope, where, blockId: block.id, blockType: block.type, kind: "page", label: "" });
        }
      }
    }
    return out;
  },
  async countsAmong(assetIds) {
    await connectDb();
    const layouts = await PageLayout.find({}).lean();
    const out = new Map<string, number>();
    for (const id of assetIds) {
      let count = 0;
      for (const layout of layouts) {
        for (const blocks of [layout.draft, layout.published]) count += blocksUsing(blocks as BlockBase[], id).length;
      }
      if (count > 0) out.set(id, count);
    }
    return out;
  },
};

type Slots = { photo?: { mediaId?: Types.ObjectId }; band?: { mediaId?: Types.ObjectId; phoneMediaId?: Types.ObjectId } };
type Named = Slots & { _id: Types.ObjectId; slug?: string; name?: string };

const SLOT_PATHS = ["photo.mediaId", "band.mediaId", "band.phoneMediaId"] as const;

function slotsUsing(doc: Slots, id: string): string[] {
  const hit = (value?: Types.ObjectId) => value !== undefined && value !== null && String(value) === id;
  return [hit(doc.photo?.mediaId) ? "photo" : "", hit(doc.band?.mediaId) ? "band" : "", hit(doc.band?.phoneMediaId) ? "band phone" : ""].filter(Boolean);
}

function catalogue(name: string, kind: "category" | "place", model: Model<never>): MediaRef {
  const Source = model as unknown as Model<Named>;
  return {
    name,
    async usagesOf(assetId) {
      await connectDb();
      if (!Types.ObjectId.isValid(assetId)) return [];
      const oid = new Types.ObjectId(assetId);
      const docs = await Source.find({ $or: SLOT_PATHS.map((path) => ({ [path]: oid })) }).select("slug name photo band").lean<Named[]>();
      return docs.flatMap((doc) =>
        slotsUsing(doc, assetId).map((slot) => ({ key: doc.slug ?? String(doc._id), scope: "catalogue", where: "published" as const, blockId: slot, blockType: kind, kind, label: doc.name ?? doc.slug ?? "" })),
      );
    },
    async countsAmong(assetIds) {
      await connectDb();
      const out = new Map<string, number>();
      const valid = assetIds.filter((id) => Types.ObjectId.isValid(id));
      if (valid.length === 0) return out;
      const oids = valid.map((id) => new Types.ObjectId(id));
      const docs = await Source.find({ $or: SLOT_PATHS.map((path) => ({ [path]: { $in: oids } })) }).select("photo band").lean<Named[]>();
      for (const id of valid) {
        const count = docs.reduce((sum, doc) => sum + slotsUsing(doc, id).length, 0);
        if (count > 0) out.set(id, count);
      }
      return out;
    },
  };
}

export const MEDIA_REFS: readonly MediaRef[] = [pages, catalogue("categories", "category", Category as unknown as Model<never>), catalogue("places", "place", Location as unknown as Model<never>)];

/** Every block, category and place that uses this image. */
export async function findMediaUsages(assetId: string): Promise<MediaUsage[]> {
  await connectDb();
  return (await Promise.all(MEDIA_REFS.map((ref) => ref.usagesOf(assetId)))).flat();
}

/** In how many places each of these images is used (images used nowhere are left out). */
export async function mediaUsageCounts(assetIds: string[]): Promise<Map<string, number>> {
  await connectDb();
  const found = await Promise.all(MEDIA_REFS.map((ref) => ref.countsAmong(assetIds)));
  const total = new Map<string, number>();
  for (const map of found) for (const [id, count] of map) total.set(id, (total.get(id) ?? 0) + count);
  return total;
}
