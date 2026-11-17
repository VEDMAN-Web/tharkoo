import type { QueryFilter, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { FEE_REF } from "@/server/billing/posting-fee";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http";
import { demoFilter } from "@/server/listings/demo-ads";
import { adPhotoUrl } from "@/server/media/photo-url";
import { Category, Listing, ListingVersion, Location, MediaAsset, Site, User, WalletEntry } from "@/server/models";

export type ReviewTab = "live" | "held" | "edited";
export const REVIEW_TABS: readonly ReviewTab[] = ["live", "held", "edited"];
export const REVIEW_PAGE_SIZES = [25, 50, 100] as const;
const SEARCH_MAX = 120;
const PHOTOS_SHOWN = 6;

export type ReviewQuery = { tab: ReviewTab; q: string; page: number; pageSize: number };

export function parseReviewQuery(params: Record<string, string | string[] | undefined>): ReviewQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  return {
    tab: (REVIEW_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as ReviewTab) : "live",
    q: one("q").trim().slice(0, SEARCH_MAX),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (REVIEW_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

export type ReviewRow = { id: string; title: string; category: string; city: string; seller: string; since: string; paid: boolean };
export type ReviewList = { query: ReviewQuery; rows: ReviewRow[]; total: number; counts: Record<ReviewTab, number> };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function tabFilter(tab: ReviewTab): Promise<QueryFilter<Record<string, unknown>>> {
  const demo = await demoFilter();
  const skip = demo ? { $nor: [demo] } : {};
  if (tab === "held") return { ...skip, status: "pending" };
  if (tab === "edited") {
    const waiting = await MediaAsset.distinct("listingId", { kind: "image", status: "scanning", listingId: { $ne: null } });
    return { ...skip, status: "active", _id: { $in: waiting } };
  }
  const site = await Site.findOne().select("postModerationSince").lean<{ postModerationSince?: Date | null } | null>();
  const since = site?.postModerationSince;
  if (!since) return { _id: { $in: [] } };
  return { ...skip, status: "active", lastModerationAt: { $exists: false }, publishedAt: { $gt: since } };
}

const SORT: Record<ReviewTab, Record<string, 1>> = { live: { publishedAt: 1 }, held: { createdAt: 1 }, edited: { updatedAt: 1 } };

export async function reviewCounts(): Promise<Record<ReviewTab, number>> {
  await connectDb();
  const [live, held, edited] = await Promise.all(REVIEW_TABS.map(async (tab) => Listing.countDocuments(await tabFilter(tab))));
  return { live, held, edited };
}

type Named = { _id: unknown; name?: string; displayName?: string };
const nameOf = (list: Named[], id: unknown, key: "name" | "displayName" = "name") => list.find((item) => String(item._id) === String(id))?.[key] || "";

export async function listReviewTab(roles: readonly string[], query: ReviewQuery): Promise<ReviewList> {
  if (!can(roles, "ads.review")) throw new ForbiddenError("Only a moderator or admin can review ads");
  await connectDb();
  const base = await tabFilter(query.tab);
  const filter = query.q ? { ...base, title: { $regex: escapeRegex(query.q), $options: "i" } } : base;
  const [counts, total, rows] = await Promise.all([
    reviewCounts(),
    Listing.countDocuments(filter),
    Listing.find(filter)
      .sort(SORT[query.tab])
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .select("title categoryId cityId ownerId publishedAt createdAt")
      .lean(),
  ]);
  const [cats, places, owners, fees] = await Promise.all([
    Category.find({ _id: { $in: rows.map((row) => row.categoryId) } }).select("name").lean<Named[]>(),
    Location.find({ _id: { $in: rows.flatMap((row) => (row.cityId ? [row.cityId] : [])) } }).select("name").lean<Named[]>(),
    User.find({ _id: { $in: rows.map((row) => row.ownerId) } }).select("displayName").lean<Named[]>(),
    WalletEntry.find({ refType: FEE_REF, refId: { $in: rows.map((row) => `${row._id}:0`) } }).select("refId").lean<{ refId: string }[]>(),
  ]);
  const paid = new Set(fees.map((fee) => fee.refId.split(":")[0]));
  return {
    query,
    total,
    counts,
    rows: rows.map((row) => ({
      id: String(row._id),
      title: row.title || "",
      category: nameOf(cats, row.categoryId),
      city: nameOf(places, row.cityId),
      seller: nameOf(owners, row.ownerId, "displayName"),
      since: new Date(row.publishedAt ?? row.createdAt ?? Date.now()).toISOString(),
      paid: paid.has(String(row._id)),
    })),
  };
}

export type ReviewDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  city: string;
  seller: string;
  photos: string[];
  paid: boolean;
  changes: { field: string; before: string; after: string }[];
};

const DIFF_FIELDS = ["title", "description", "price"] as const;

export async function getReviewDetail(roles: readonly string[], id: string): Promise<ReviewDetail> {
  if (!can(roles, "ads.review")) throw new ForbiddenError("Only a moderator or admin can review ads");
  await connectDb();
  const listing = await Listing.findById(id).lean();
  if (!listing) throw new NotFoundError("Ad not found");
  const [category, city, owner, fee, assets, last] = await Promise.all([
    Category.findById(listing.categoryId).select("name").lean<Named | null>(),
    listing.cityId ? Location.findById(listing.cityId).select("name").lean<Named | null>() : null,
    User.findById(listing.ownerId).select("displayName").lean<Named | null>(),
    WalletEntry.exists({ refType: FEE_REF, refId: `${listing._id}:0` }),
    MediaAsset.find({ _id: { $in: listing.mediaIds ?? [] }, kind: "image" }).select("objectKey").lean<{ _id: Types.ObjectId; objectKey: string }[]>(),
    ListingVersion.findOne({ listingId: listing._id }).sort({ version: -1 }).lean(),
  ]);
  const before = (last?.snapshot ?? {}) as Record<string, unknown>;
  const now = listing as unknown as Record<string, unknown>;
  const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));
  return {
    id: String(listing._id),
    title: listing.title || "",
    description: listing.description || "",
    status: listing.status || "",
    category: category?.name || "",
    city: city?.name || "",
    seller: owner?.displayName || "",
    photos: assets.slice(0, PHOTOS_SHOWN).map((asset) => adPhotoUrl(asset.objectKey)).filter((src): src is string => Boolean(src)),
    paid: Boolean(fee),
    changes: last ? DIFF_FIELDS.filter((field) => text(before[field]) !== text(now[field])).map((field) => ({ field, before: text(before[field]), after: text(now[field]) })) : [],
  };
}

/** "Mark checked": the ad stays live and leaves the Live, not checked list. Held ads are approved with approveListing instead. */
export async function markChecked(ctx: AdminCtx, id: string) {
  await connectDb();
  return adminWrite<{ id: string }>(ctx, {
    perm: "ads.review",
    action: "listing.checked",
    target: { type: "listing", id },
    before: async () => {
      const listing = await Listing.findById(id).select("status lastModerationAt").lean();
      if (!listing) throw new NotFoundError("Ad not found");
      if (listing.status !== "active") throw new ConflictError(`This ad is ${listing.status}, not live`);
      return { status: listing.status, lastModerationAt: listing.lastModerationAt ?? null };
    },
    apply: async () => {
      const when = new Date();
      await Listing.updateOne({ _id: id }, { $set: { lastModerationAt: when } });
      return { after: { lastModerationAt: when.toISOString() }, result: { id }, summary: "Marked an ad as checked" };
    },
  });
}
