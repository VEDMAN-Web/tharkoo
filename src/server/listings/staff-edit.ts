import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { diffFields, type DiffRow } from "@/components/admin/ui/kit-helpers";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { assertCleanText, fieldDefs, writeVersion } from "@/server/listings/service";
import { adCountsFor, type AdCountsView } from "@/server/listings/ad-counts";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { parsePrice } from "@/server/listings/price";
import { adPhotoUrl } from "@/server/media/photo-url";
import { paidCreditsFor } from "@/server/moderation/review";
import { AuditEvent, Category, Listing, ListingVersion, Location, MediaAsset, PromotionOrder, PromotionProduct, User, WalletEntry } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { withPickLimits } from "@/server/fields/service";
import { parseListingAttributes } from "@/server/shared/fields";

export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 4000;
const PHOTOS_SHOWN = 12;
const NOT_EDITABLE = new Set(["removed", "deleted", "draft"]);

export type AdField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  optionLabels: Record<string, string>;
  unit: string;
  help: string;
  placeholder: string;
};

export type StaffAdValues = { title: string; description: string; price: number | ""; attributes: Record<string, unknown> };

export type StaffAd = {
  id: string;
  slug: string;
  status: string;
  values: StaffAdValues;
  fields: AdField[];
  category: string;
  subcategory: string;
  place: string;
  photos: string[];
  expiresAt: string | null;
  createdAt: string | null;
  seller: { id: string; name: string; liveAds: number; idCheck: string };
  money: { feeCredits: number; promotions: { name: string; status: string; until: string | null }[] };
  counts: AdCountsView | null;
  access: { edit: boolean; counts: boolean };
};

type Doc = Record<string, unknown>;

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function valuesOf(source: Doc): StaffAdValues {
  const price = typeof source.price === "number" ? source.price : "";
  const attributes = source.attributes && typeof source.attributes === "object" && !Array.isArray(source.attributes) ? (source.attributes as Record<string, unknown>) : {};
  return { title: String(source.title ?? ""), description: String(source.description ?? ""), price, attributes };
}

function requireView(roles: readonly string[]) {
  if (!can(roles, "ads.view")) throw new ForbiddenError("You cannot open this ad");
}

export async function getStaffAd(roles: readonly string[], id: string): Promise<StaffAd> {
  requireView(roles);
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Ad not found");
  const listing = await Listing.findById(id).lean<Doc | null>();
  if (!listing) throw new NotFoundError("Ad not found");
  const category = await Category.findById(listing.categoryId as Types.ObjectId).lean<{ _id: Types.ObjectId; name?: string; slug: string; fields?: never[] } | null>();
  const [sub, place, owner, fees, assets, orders, counts, liveAds] = await Promise.all([
    listing.subcategoryId ? Subcategory.findById(listing.subcategoryId as Types.ObjectId).select("name").lean<{ name?: string } | null>() : null,
    listing.cityId ? Location.findById(listing.cityId as Types.ObjectId).select("name").lean<{ name?: string } | null>() : null,
    User.findById(listing.ownerId as Types.ObjectId).select("displayName verificationStatus").lean<{ displayName?: string; verificationStatus?: string } | null>(),
    paidCreditsFor([id]),
    MediaAsset.find({ _id: { $in: ((listing.mediaIds as Types.ObjectId[]) ?? []).slice(0, PHOTOS_SHOWN) } }).select("objectKey").lean<{ _id: Types.ObjectId; objectKey: string }[]>(),
    PromotionOrder.find({ listingId: new Types.ObjectId(id) }).sort({ createdAt: -1 }).limit(5).lean<Doc[]>(),
    can(roles, "ads.edit") ? adCountsFor(id) : null,
    Listing.countDocuments({ ownerId: listing.ownerId as Types.ObjectId, status: "active" }),
  ]);
  const products = await PromotionProduct.find({ _id: { $in: orders.map((order) => order.productId as Types.ObjectId) } }).select("name").lean<{ _id: Types.ObjectId; name?: string }[]>();
  const fields = category
    ? fieldDefs(category as never)
        .filter((field) => field.enabled)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: Boolean(field.required),
          options: field.options ?? [],
          optionLabels: (field.optionLabels as Record<string, string> | undefined) ?? {},
          unit: field.unit ?? "",
          help: "",
          placeholder: field.placeholder ?? "",
        }))
    : [];
  const byId = new Map(assets.map((asset) => [String(asset._id), adPhotoUrl(asset.objectKey)]));
  return {
    id,
    slug: String(listing.slug ?? ""),
    status: String(listing.status ?? ""),
    values: valuesOf(plain(listing)),
    fields,
    category: category?.name ?? "",
    subcategory: sub?.name ?? "",
    place: place?.name ?? "",
    photos: ((listing.mediaIds as Types.ObjectId[]) ?? []).map((mediaId) => byId.get(String(mediaId))).filter((url): url is string => Boolean(url)),
    expiresAt: listing.expiresAt ? new Date(listing.expiresAt as Date).toISOString() : null,
    createdAt: listing.createdAt ? new Date(listing.createdAt as Date).toISOString() : null,
    seller: { id: String(listing.ownerId), name: owner?.displayName ?? "unknown", liveAds, idCheck: owner?.verificationStatus ?? "unknown" },
    money: {
      feeCredits: fees.get(id) ?? 0,
      promotions: orders.map((order) => ({
        name: products.find((product) => String(product._id) === String(order.productId))?.name ?? "Promotion",
        status: String(order.status ?? ""),
        until: order.endsAt ? new Date(order.endsAt as Date).toISOString() : null,
      })),
    },
    counts,
    access: { edit: can(roles, "ads.edit"), counts: can(roles, "ads.edit") },
  };
}

async function requireEdit(ctx: AdminCtx, id: string, action: string) {
  if (can(ctx.roles, "ads.edit")) return;
  await adminWrite(ctx, { perm: "ads.edit", action, target: { type: "listing", id }, before: async () => null, apply: async () => ({ after: null, result: null, summary: "" }) });
}

function cleanTitle(value: unknown) {
  const title = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new ValidationError("Invalid request", { title: ["Enter a title."] });
  if (title.length > TITLE_MAX) throw new ValidationError("Invalid request", { title: [`Use at most ${TITLE_MAX} characters.`] });
  return title;
}

function cleanDescription(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) throw new ValidationError("Invalid request", { description: ["Enter a description."] });
  if (text.length > DESCRIPTION_MAX) throw new ValidationError("Invalid request", { description: [`Use at most ${DESCRIPTION_MAX.toLocaleString("en-IN")} characters.`] });
  return text;
}

type Applied = { id: string; changed: boolean; title: string };

/** One edit by staff or one restore of an older version: the same checks, a new version, and an undo that holds the values before. */
async function applyEdit(ctx: AdminCtx, id: string, next: { title: unknown; description: unknown; price: unknown; attributes: unknown }, label: string): Promise<Applied & { eventId: string; undoUntil: string | null }> {
  await connectDb();
  await requireEdit(ctx, id, "listing.edit");
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Ad not found");
  const listing = await Listing.findById(id);
  if (!listing) throw new NotFoundError("Ad not found");
  if (NOT_EDITABLE.has(listing.status)) throw new ConflictError("This ad is removed or a draft, so it cannot be edited here.");
  const category = await Category.findById(listing.categoryId);
  if (!category) throw new NotFoundError("Category not found");
  const title = cleanTitle(next.title);
  const description = cleanDescription(next.description);
  const price = parsePrice(next.price === "" ? null : next.price);
  const attributes = parseListingAttributes(await withPickLimits(category.slug, fieldDefs(category)), next.attributes ?? {});
  await assertCleanText([title, description, ...Object.values(attributes).filter((value): value is string => typeof value === "string")]);
  const before = valuesOf(plain(listing.toObject() as unknown as Doc));
  const after: StaffAdValues = { title, description, price: price ?? "", attributes };
  if (JSON.stringify(before) === JSON.stringify(after)) return { id, changed: false, title, eventId: "", undoUntil: null };
  const written = await adminWrite<Applied>(ctx, {
    perm: "ads.edit",
    action: "listing.edit",
    target: { type: "listing", id, label: listing.title },
    texts: [title, description],
    undo: { kind: "listing.edit", windowKey: "edits" },
    before: async () => before as unknown as Doc,
    apply: async () => {
      listing.title = title;
      listing.description = description;
      if (price === null || price === undefined) listing.set("price", undefined);
      else listing.price = price;
      listing.attributes = attributes;
      listing.markModified("attributes");
      await listing.save();
      await writeVersion(listing as never, ctx.actorId);
      if (listing.status === "active") await revalidateListingPages(listing, category.slug);
      return {
        after: after as unknown as Doc,
        result: { id, changed: true, title },
        summary: `${label}: ${title}`,
        undoData: { id, restore: before, expect: after },
      };
    },
  });
  return { ...written.result, eventId: written.eventId, undoUntil: written.undoUntil };
}

/** A save from the edit page. A live ad stays live; the old values are one undo away. */
export async function saveStaffEdit(ctx: AdminCtx, id: string, values: { title: unknown; description: unknown; price: unknown; attributes: unknown }) {
  return applyEdit(ctx, id, values, "Edited the ad");
}

/** Going back to an older version makes a new version with the old values. Nothing is deleted. */
export async function restoreAdVersion(ctx: AdminCtx, id: string, version: number) {
  await connectDb();
  await requireEdit(ctx, id, "listing.restore");
  if (!Types.ObjectId.isValid(id) || !Number.isInteger(version) || version < 1) throw new NotFoundError("Version not found");
  const row = await ListingVersion.findOne({ listingId: new Types.ObjectId(id), version }).lean<{ snapshot: Doc } | null>();
  if (!row) throw new NotFoundError("Version not found");
  const old = valuesOf(plain(row.snapshot));
  return applyEdit(ctx, id, old, `Went back to version ${version}`);
}

export type HistoryEntryData = { id: string; version: string; title: string; meta: string; current: boolean; lockedReason?: string; changes: DiffRow[] };
export type AdHistory = { versions: HistoryEntryData[]; decisions: HistoryEntryData[]; money: HistoryEntryData[] };

const DECISION_WORDS: Record<string, string> = {
  "listing.approve": "Approved",
  "listing.reject": "Rejected",
  "listing.remove": "Removed",
  "listing.pause": "Paused",
  "listing.resume": "Resumed",
  "listing.extend": "Extended by 30 days",
  "listing.edit": "Edited by staff",
  "listing.restore": "Went back to an older version",
};

function when(date: unknown) {
  return new Date(date as Date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

export async function getAdHistory(roles: readonly string[], id: string): Promise<AdHistory> {
  requireView(roles);
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Ad not found");
  const listing = await Listing.findById(id).select("ownerId status").lean<{ ownerId: Types.ObjectId; status: string } | null>();
  if (!listing) throw new NotFoundError("Ad not found");
  const [rows, events, wallet] = await Promise.all([
    ListingVersion.find({ listingId: new Types.ObjectId(id) }).sort({ version: -1 }).limit(30).lean<{ version: number; snapshot: Doc; actorId: Types.ObjectId; createdAt?: Date }[]>(),
    AuditEvent.find({ targetType: "listing", targetId: id, action: { $in: Object.keys(DECISION_WORDS) } }).sort({ _id: -1 }).limit(30).lean<{ _id: Types.ObjectId; action: string; actorId?: Types.ObjectId; reason?: string; summary?: string; createdAt?: Date }[]>(),
    WalletEntry.find({ refId: { $regex: `^${id}:` } }).sort({ _id: -1 }).limit(20).lean<{ _id: Types.ObjectId; delta: number; refType: string; createdAt?: Date }[]>(),
  ]);
  const people = await User.find({ _id: { $in: [...rows.map((row) => row.actorId), ...events.flatMap((event) => (event.actorId ? [event.actorId] : []))] } }).select("displayName").lean<{ _id: Types.ObjectId; displayName?: string }[]>();
  const nameOf = (userId?: Types.ObjectId) => people.find((person) => String(person._id) === String(userId))?.displayName ?? "someone";
  const current = rows[0] ? valuesOf(plain(rows[0].snapshot)) : null;
  const versions = rows.map((row, index): HistoryEntryData => {
    const values = valuesOf(plain(row.snapshot));
    const previous = rows[index + 1] ? valuesOf(plain(rows[index + 1].snapshot)) : null;
    const owner = String(row.actorId) === String(listing.ownerId);
    const changed = previous ? diffFields(previous, values) : [];
    return {
      id: String(row.version),
      version: `v${row.version}`,
      title: index === rows.length - 1 && !previous ? `Posted by ${nameOf(row.actorId)}` : `${owner ? "Edited by the seller" : `Edited by ${nameOf(row.actorId)}`}`,
      meta: `${row.createdAt ? when(row.createdAt) : ""}${changed.length ? ` · ${changed.slice(0, 2).map((item) => item.path.replace(/^attributes\./, "")).join(", ")} changed` : ""}`,
      current: index === 0,
      changes: index === 0 || !current ? [] : diffFields(current, values),
    };
  });
  const decisions = events.map((event): HistoryEntryData => ({
    id: String(event._id),
    version: DECISION_WORDS[event.action] ?? event.action,
    title: `${DECISION_WORDS[event.action] ?? event.action} by ${nameOf(event.actorId)}`,
    meta: `${event.createdAt ? when(event.createdAt) : ""}${event.reason ? ` · ${event.reason}` : ""}`,
    current: false,
    lockedReason: "A decision is not restored from here. Use Undo in History and undo.",
    changes: [],
  }));
  const money = wallet.map((entry): HistoryEntryData => ({
    id: String(entry._id),
    version: entry.delta < 0 ? "Fee" : "Back",
    title: entry.delta < 0 ? `Posting fee ${Math.abs(entry.delta)} credits` : `${entry.delta} credits given back`,
    meta: entry.createdAt ? when(entry.createdAt) : "",
    current: false,
    lockedReason: "Money that moved is never undone from here.",
    changes: [],
  }));
  return { versions, decisions, money };
}
