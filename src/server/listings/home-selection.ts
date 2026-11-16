import { z } from "zod";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Listing } from "@/server/models/listing";
import { escapeRegExp, loadCategories, presentRows } from "@/server/search/query";
import { loadLocations } from "@/server/locations";

const audit = new AuditRepository();
const MAX_ORDER = 9999;
const SEARCH_LIMIT = 20;
const BATCH_LIMIT = 100;

export const homeSelectionSchema = z
  .object({
    show: z.boolean(),
    order: z.number().int().min(0).max(MAX_ORDER),
  })
  .strict();

export type HomeSelectionRow = {
  id: string;
  title: string;
  status: string;
  show: boolean;
  order: number;
  thumb: string | null;
  city: string;
  category: string;
};

export type HomePickerData = { pinned: HomeSelectionRow[]; results: HomeSelectionRow[] };

type PickerDoc = {
  _id: Types.ObjectId;
  ownerId?: Types.ObjectId;
  slug?: string;
  title?: string;
  status?: string;
  homeShow?: boolean;
  homeOrder?: number;
  categoryId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  stateId?: Types.ObjectId;
  districtId?: Types.ObjectId;
  localityId?: Types.ObjectId;
  mediaIds?: Types.ObjectId[];
};

const PICKER_FIELDS = "title slug status homeShow homeOrder ownerId categoryId cityId stateId districtId localityId mediaIds";

async function toRows(docs: PickerDoc[]): Promise<HomeSelectionRow[]> {
  if (docs.length === 0) return [];
  const presented = await presentRows(docs as never, new Map(), new Date());
  const bySlug = new Map(presented.hits.map((hit) => [hit.slug ?? "", hit]));
  return docs.map((doc) => {
    const hit = bySlug.get(doc.slug ?? "");
    return {
      id: String(doc._id),
      title: doc.title || "Untitled",
      status: doc.status || "",
      show: doc.homeShow === true,
      order: doc.homeOrder ?? 0,
      thumb: hit?.photos?.[0] ?? null,
      city: hit?.place || "",
      category: hit?.categorySlug || "",
    };
  });
}

export async function homePickerData(search = ""): Promise<HomePickerData> {
  await connectDb();
  const chosen = await Listing.find({ homeShow: true }).sort({ homeOrder: 1, updatedAt: -1 }).select(PICKER_FIELDS).lean<PickerDoc[]>();
  const query = search.trim().slice(0, 60);
  const filter: Record<string, unknown> = { homeShow: { $ne: true }, status: "active" };
  if (query) {
    const pattern = new RegExp(escapeRegExp(query), "i");
    const [categories, locations] = await Promise.all([loadCategories(), loadLocations()]);
    const categoryIds = categories.filter((row) => pattern.test(row.name || "") || pattern.test(row.slug || "")).map((row) => row._id);
    const cityIds = locations.filter((row) => (row.type === "city" || row.type === "district") && (pattern.test(row.name || "") || pattern.test(row.slug || ""))).map((row) => row._id);
    filter.$or = [{ title: pattern }, { categoryId: { $in: categoryIds } }, { cityId: { $in: cityIds } }, { districtId: { $in: cityIds } }];
  }
  const found = await Listing.find(filter).sort({ updatedAt: -1 }).limit(SEARCH_LIMIT).select(PICKER_FIELDS).lean<PickerDoc[]>();
  const rows = await toRows([...chosen, ...found]);
  return { pinned: rows.slice(0, chosen.length), results: rows.slice(chosen.length) };
}

export async function setHomeSelection(input: {
  listingId: string;
  show: boolean;
  order: number;
  actor: { id: string; roles: string[] };
  requestId: string;
}) {
  if (!isAdminRole(input.actor.roles)) throw new ForbiddenError("Only an admin can choose the ads on Home");
  const parsed = homeSelectionSchema.safeParse({ show: input.show, order: input.order });
  if (!parsed.success) throw new ValidationError("Enter an order from 0 to 9999");
  if (!Types.ObjectId.isValid(input.listingId)) throw new NotFoundError("Ad not found");
  await connectDb();
  const before = await Listing.findById(input.listingId).select("homeShow homeOrder").lean<{ homeShow?: boolean; homeOrder?: number } | null>();
  if (!before) throw new NotFoundError("Ad not found");
  await Listing.updateOne({ _id: input.listingId }, { $set: { homeShow: parsed.data.show, homeOrder: parsed.data.order } }, { timestamps: false });
  await refreshPublicCache();
  await audit.append({
    actorId: input.actor.id,
    actorType: "admin",
    action: "ad.home.update",
    targetType: "listing",
    targetId: input.listingId,
    requestId: input.requestId,
    before: { show: before.homeShow === true, order: before.homeOrder ?? 0 },
    after: { show: parsed.data.show, order: parsed.data.order },
  });
  return { show: parsed.data.show, order: parsed.data.order };
}

export const homeBatchSchema = z
  .array(z.object({ listingId: z.string().min(1).max(40), show: z.boolean(), order: z.number().int().min(0).max(MAX_ORDER) }).strict())
  .max(BATCH_LIMIT);

export async function setHomeSelectionBatch(input: {
  items: unknown;
  actor: { id: string; roles: string[] };
  requestId: string;
}) {
  if (!isAdminRole(input.actor.roles)) throw new ForbiddenError("Only an admin can choose the ads on Home");
  const parsed = homeBatchSchema.safeParse(input.items);
  if (!parsed.success) throw new ValidationError("Check the order numbers: whole numbers from 0 to 9999");
  const items = parsed.data;
  if (items.some((item) => !Types.ObjectId.isValid(item.listingId))) throw new NotFoundError("Ad not found");
  await connectDb();
  const ids = items.map((item) => new Types.ObjectId(item.listingId));
  const existing = await Listing.find({ _id: { $in: ids } }).select("homeShow homeOrder").lean<{ _id: Types.ObjectId; homeShow?: boolean; homeOrder?: number }[]>();
  if (existing.length !== new Set(items.map((item) => item.listingId)).size) throw new NotFoundError("Ad not found");
  const before = new Map(existing.map((row) => [String(row._id), { show: row.homeShow === true, order: row.homeOrder ?? 0 }]));
  const changed = items.filter((item) => {
    const old = before.get(item.listingId);
    return !old || old.show !== item.show || old.order !== item.order;
  });
  if (changed.length > 0) {
    await Listing.bulkWrite(
      changed.map((item) => ({ updateOne: { filter: { _id: new Types.ObjectId(item.listingId) }, update: { $set: { homeShow: item.show, homeOrder: item.order } } } })),
      { timestamps: false },
    );
    await refreshPublicCache();
    await audit.append({
      actorId: input.actor.id,
      actorType: "admin",
      action: "ad.home.update",
      targetType: "listing",
      targetId: changed.map((item) => item.listingId).join(","),
      requestId: input.requestId,
      before: Object.fromEntries(changed.map((item) => [item.listingId, before.get(item.listingId)])),
      after: Object.fromEntries(changed.map((item) => [item.listingId, { show: item.show, order: item.order }])),
    });
  }
  return { changed: changed.length };
}
