import type { QueryFilter, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { JUNK_PATTERN_SOURCES, looksLikeJunk } from "@/lib/admin/ads-junk";
import { FEE_REF, FEE_REFUND_REF } from "@/server/billing/posting-fee";
import { ForbiddenError } from "@/server/http";
import { demoFilter, DEMO_SLUG } from "@/server/listings/demo-ads";
import { paidCreditsFor } from "@/server/moderation/review";
import { previewUrlOf } from "@/server/media/mine";
import { Category, Listing, Location, MediaAsset, PromotionOrder, User, WalletEntry } from "@/server/models";
import { normalizePhone, PhoneIdentity } from "@/server/auth/phone";
import type { ListingDoc } from "@/server/models/listing";

export const ADS_TABS = ["all", "live", "review", "paused", "removed", "expired", "promoted", "demo"] as const;
export type AdsTab = (typeof ADS_TABS)[number];
export const ADS_PAGE_SIZES = [25, 50, 100] as const;
export type AdsKind = "all" | "real" | "demo";
export type AdsPaid = "all" | "paid" | "free";
export const ADS_SORTS = ["new", "ends", "ends_last"] as const;
export type AdsSort = (typeof ADS_SORTS)[number];
const ENDS_SOON_HOURS = 24;

const SEARCH_MAX = 120;
const FOUND_MAX = 200;
const NAME_MIN = 2;
const HOME_SLOTS = 8;
const CITY_MATCH_MAX = 50;
const NOT_AN_AD: ListingDoc["status"][] = ["draft", "deleted"];

const TAB_STATUSES: Partial<Record<AdsTab, ListingDoc["status"][]>> = {
  live: ["active"],
  review: ["pending"],
  paused: ["paused"],
  removed: ["removed", "rejected"],
  expired: ["expired", "archived"],
};

export type AdsQuery = {
  tab: AdsTab;
  q: string;
  page: number;
  pageSize: number;
  junk: boolean;
  home: boolean;
  kind: AdsKind;
  paid: AdsPaid;
  category: string;
  city: string;
  sort: AdsSort;
  /** Only live or paused ads that end within the next 24 hours. */
  endsSoon: boolean;
};

export type AdRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  city: string;
  seller: string;
  /** A small picture of the ad (its cover, else its first photo), or null when it has none. */
  thumb: string | null;
  createdAt: string;
  expiresAt: string | null;
  paidCredits: number;
  promoted: boolean;
  demo: boolean;
  junk: boolean;
  homeSlot: number | null;
  onHome: boolean;
};

export type AdsList = {
  rows: AdRow[];
  total: number;
  counts: Record<AdsTab, number>;
  query: AdsQuery;
  categories: { id: string; name: string }[];
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseAdsQuery(params: Record<string, string | string[] | undefined>): AdsQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  const kind = one("kind");
  const paid = one("paid");
  const category = one("cat");
  return {
    tab: (ADS_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as AdsTab) : "all",
    q: one("q").trim().slice(0, SEARCH_MAX),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (ADS_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    junk: one("junk") === "1",
    home: one("home") === "1",
    kind: kind === "real" || kind === "demo" ? kind : "all",
    paid: paid === "paid" || paid === "free" ? paid : "all",
    category: /^[a-f0-9]{24}$/i.test(category) ? category.toLowerCase() : "",
    city: one("city").trim().slice(0, 60),
    sort: (ADS_SORTS as readonly string[]).includes(one("sort")) ? (one("sort") as AdsSort) : "new",
    endsSoon: one("ends") === "24",
  };
}

/** The ads whose posting fee is paid now: fees minus fees given back, in one aggregate over the wallet lines. */
export async function paidAdIds(): Promise<Types.ObjectId[]> {
  await connectDb();
  const rows = await WalletEntry.aggregate<{ _id: string }>([
    { $match: { refType: { $in: [FEE_REF, FEE_REFUND_REF] } } },
    { $group: { _id: { $arrayElemAt: [{ $split: ["$refId", ":"] }, 0] }, net: { $sum: "$delta" } } },
    { $match: { net: { $lt: 0 } } },
  ]);
  return rows.filter((row) => /^[a-f0-9]{24}$/i.test(row._id)).map((row) => row._id as unknown as Types.ObjectId);
}

async function promotedIds(): Promise<Types.ObjectId[]> {
  return PromotionOrder.distinct("listingId", { status: "active", endsAt: { $gt: new Date() } });
}

async function ownersFor(raw: string): Promise<Types.ObjectId[]> {
  const q = raw.trim();
  if (q.includes("@")) {
    const row = await User.findOne({ email: q.toLowerCase() }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    return row ? [row._id] : [];
  }
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 8 && /^[+\d\s()-]+$/.test(q)) {
    const candidates = Array.from(new Set([normalizePhone(q), q, `+${digits}`].filter(Boolean)));
    const rows = await PhoneIdentity.find({ phone: { $in: candidates } }).select("userId").limit(FOUND_MAX).lean<{ userId: Types.ObjectId }[]>();
    return rows.map((row) => row.userId);
  }
  if (q.length < NAME_MIN) return [];
  const rows = await User.find({ displayName: { $regex: `^${escapeRegex(q)}`, $options: "i" } }).select("_id").limit(FOUND_MAX).lean<{ _id: Types.ObjectId }[]>();
  return rows.map((row) => row._id);
}

async function searchFilter(q: string): Promise<QueryFilter<ListingDoc>> {
  if (/^[a-f0-9]{24}$/i.test(q)) return { _id: q.toLowerCase() } as QueryFilter<ListingDoc>;
  if (DEMO_SLUG.test(q.toLowerCase())) return { slug: q.toLowerCase() };
  const owners = await ownersFor(q);
  const byTitle = { title: { $regex: escapeRegex(q), $options: "i" } };
  return owners.length ? { $or: [byTitle, { ownerId: { $in: owners } }] } : byTitle;
}

async function cityFilter(name: string): Promise<QueryFilter<ListingDoc>> {
  const rows = await Location.find({ name: { $regex: `^${escapeRegex(name)}`, $options: "i" }, type: { $in: ["city", "district"] } })
    .select("_id")
    .limit(CITY_MATCH_MAX)
    .lean<{ _id: Types.ObjectId }[]>();
  const ids = rows.map((row) => row._id);
  return { $or: [{ cityId: { $in: ids } }, { districtId: { $in: ids } }] };
}

async function tabFilter(tab: AdsTab): Promise<QueryFilter<ListingDoc>> {
  if (tab === "all") return { status: { $nin: NOT_AN_AD } };
  if (tab === "promoted") return { status: { $nin: NOT_AN_AD }, _id: { $in: await promotedIds() } };
  if (tab === "demo") return { status: { $nin: NOT_AN_AD }, ...((await demoFilter()) ?? { _id: null }) };
  return { status: { $in: TAB_STATUSES[tab] ?? [] } };
}

async function filterFor(query: AdsQuery): Promise<QueryFilter<ListingDoc>> {
  const parts: QueryFilter<ListingDoc>[] = [await tabFilter(query.tab)];
  if (query.q) parts.push(await searchFilter(query.q));
  if (query.junk) parts.push({ $or: JUNK_PATTERN_SOURCES.map((source) => ({ title: { $regex: source, $options: "i" } })) });
  if (query.home) parts.push({ homeShow: true });
  if (query.endsSoon) parts.push({ status: { $in: ["active", "paused"] }, expiresAt: { $gt: new Date(), $lte: new Date(Date.now() + ENDS_SOON_HOURS * 3_600_000) } });
  if (query.category) parts.push({ $or: [{ categoryId: query.category }, { subcategoryId: query.category }] } as QueryFilter<ListingDoc>);
  if (query.city) parts.push(await cityFilter(query.city));
  if (query.kind !== "all" && query.tab !== "demo") {
    const demo = await demoFilter();
    if (query.kind === "demo") parts.push(demo ?? { _id: null });
    else if (demo) parts.push({ $nor: [demo] });
  }
  if (query.paid !== "all") {
    const ids = await paidAdIds();
    parts.push(query.paid === "paid" ? { _id: { $in: ids } } : { _id: { $nin: ids } });
  }
  return parts.length === 1 ? parts[0] : { $and: parts };
}

export async function adsCounts(): Promise<Record<AdsTab, number>> {
  await connectDb();
  const [byStatus, promoted, demoFilterValue] = await Promise.all([
    Listing.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    promotedIds(),
    demoFilter(),
  ]);
  const count = (statuses: string[]) => byStatus.filter((row) => statuses.includes(row._id)).reduce((sum, row) => sum + row.n, 0);
  const promotedCount = promoted.length ? await Listing.countDocuments({ _id: { $in: promoted }, status: { $nin: NOT_AN_AD } }) : 0;
  const demoCount = demoFilterValue ? await Listing.countDocuments({ ...demoFilterValue, status: { $nin: NOT_AN_AD } }) : 0;
  return {
    all: byStatus.filter((row) => !NOT_AN_AD.includes(row._id as ListingDoc["status"])).reduce((sum, row) => sum + row.n, 0),
    live: count(TAB_STATUSES.live ?? []),
    review: count(TAB_STATUSES.review ?? []),
    paused: count(TAB_STATUSES.paused ?? []),
    removed: count(TAB_STATUSES.removed ?? []),
    expired: count(TAB_STATUSES.expired ?? []),
    promoted: promotedCount,
    demo: demoCount,
  };
}

type Lean = Pick<ListingDoc, "title" | "status" | "categoryId" | "cityId" | "ownerId" | "slug" | "createdAt" | "expiresAt" | "homeShow" | "coverMediaId" | "mediaIds"> & { _id: Types.ObjectId };

/** What the list calls the account that owns the built-in demo ads. Only the shown word changes. */
export const DEMO_SELLER_WORD = "Demo";

async function thumbsFor(rows: readonly Lean[]): Promise<Map<string, string>> {
  const coverOf = (row: Lean) => row.coverMediaId ?? row.mediaIds?.[0];
  const ids = rows.flatMap((row) => (coverOf(row) ? [coverOf(row) as Types.ObjectId] : []));
  if (ids.length === 0) return new Map();
  const assets = await MediaAsset.find({ _id: { $in: ids }, kind: "image" }).select("kind objectKey").lean();
  const urls = new Map(assets.map((asset) => [String(asset._id), previewUrlOf(asset).url] as const));
  return new Map(rows.flatMap((row) => { const url = urls.get(String(coverOf(row))); return url ? [[String(row._id), url] as const] : []; }));
}
type Named = { _id: unknown; name?: string; displayName?: string };
const nameOf = (list: Named[], id: unknown, key: "name" | "displayName" = "name") => list.find((item) => String(item._id) === String(id))?.[key] || "";

async function homeSlots(): Promise<Map<string, number>> {
  const chosen = await Listing.find({ homeShow: true, status: "active" }).sort({ homeOrder: 1, updatedAt: -1 }).limit(HOME_SLOTS).select("_id").lean<{ _id: Types.ObjectId }[]>();
  return new Map(chosen.map((row, index) => [String(row._id), index + 1]));
}

/** The All ads list: one tab, one search, a few filters, one page. The tab counts ignore the search and the filters. */
export async function listAds(roles: readonly string[], query: AdsQuery): Promise<AdsList> {
  if (!can(roles, "ads.view")) throw new ForbiddenError("You cannot open All ads");
  await connectDb();
  const filter = await filterFor(query);
  const [counts, total, rows, categories, slots, demo] = await Promise.all([
    adsCounts(),
    Listing.countDocuments(filter),
    Listing.find(filter)
      .sort(query.sort === "ends" ? { expiresAt: 1, _id: 1 } : query.sort === "ends_last" ? { expiresAt: -1, _id: -1 } : { createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .select("title status categoryId cityId ownerId slug createdAt expiresAt homeShow coverMediaId mediaIds")
      .lean<Lean[]>(),
    Category.find({}).select("name").sort({ name: 1 }).lean<Named[]>(),
    homeSlots(),
    demoFilter(),
  ]);
  const ids = rows.map((row) => row._id);
  const [cats, places, owners, fees, promoted, thumbs] = await Promise.all([
    Category.find({ _id: { $in: rows.map((row) => row.categoryId) } }).select("name").lean<Named[]>(),
    Location.find({ _id: { $in: rows.flatMap((row) => (row.cityId ? [row.cityId] : [])) } }).select("name").lean<Named[]>(),
    User.find({ _id: { $in: rows.map((row) => row.ownerId) } }).select("displayName").lean<Named[]>(),
    paidCreditsFor(ids.map(String)),
    ids.length ? PromotionOrder.distinct("listingId", { listingId: { $in: ids }, status: "active", endsAt: { $gt: new Date() } }) : [],
    thumbsFor(rows),
  ]);
  const promotedSet = new Set(promoted.map(String));
  return {
    query,
    total,
    counts,
    categories: categories.map((row) => ({ id: String(row._id), name: row.name ?? "" })),
    rows: rows.map((row) => ({
      id: String(row._id),
      title: row.title || "Untitled",
      status: row.status,
      category: nameOf(cats, row.categoryId),
      city: nameOf(places, row.cityId),
      seller: demo && String(row.ownerId) === String(demo.ownerId) ? DEMO_SELLER_WORD : nameOf(owners, row.ownerId, "displayName"),
      thumb: thumbs.get(String(row._id)) ?? null,
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      paidCredits: fees.get(String(row._id)) ?? 0,
      promoted: promotedSet.has(String(row._id)),
      demo: Boolean(demo && String(row.ownerId) === String(demo.ownerId) && DEMO_SLUG.test(row.slug ?? "")),
      junk: looksLikeJunk(row.title || ""),
      homeSlot: slots.get(String(row._id)) ?? null,
      onHome: row.homeShow === true,
    })),
  };
}
