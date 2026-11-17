import mongoose, { type QueryFilter, type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { normalizePhone, PhoneIdentity } from "@/server/auth/phone";
import { walletBalance } from "@/server/billing/ledger";
import { accountBalance } from "@/server/ledger";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { AuditEvent, Listing, Session, SiteMedia, User, WalletEntry } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { STAFF_ROLE_NAMES, type UserDoc } from "@/server/models/identity";

/** H8.8 (A8): the Users screen, read only. Ban, log out and credits come with later cards. */

/** The built-in demo account shows as "Demo" in the lists. Only the shown word changes; the stored name stays. */
export const DEMO_USER_WORD = "Demo";
const shownName = (doc: { displayName: string; email: string }) => (doc.email === SEED_USER_EMAIL ? DEMO_USER_WORD : doc.displayName);

export type UserTab = "all" | "sellers" | "id" | "banned" | "staff";
export const USER_TABS: readonly UserTab[] = ["all", "sellers", "id", "banned", "staff"];
export const USER_PAGE_SIZES = [25, 50, 100] as const;
const MAX_RESULTS_FROM_KEY = 200;
const NAME_PREFIX_MIN = 2;

export type UserQuery = { tab: UserTab; q: string; page: number; pageSize: number; ads?: boolean; credits?: boolean };

/** Reads the tab, search, page and page size from the address, with safe defaults. */
export function parseUserQuery(params: Record<string, string | string[] | undefined>): UserQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const tab = (USER_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as UserTab) : "all";
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  return {
    tab,
    q: one("q").trim().slice(0, 120),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (USER_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    ads: one("ads") === "1",
    credits: one("credits") === "1",
  };
}

export type SearchKind = "empty" | "email" | "phone" | "ad" | "name";

/** What a search box entry looks like: an exact email, a phone number, an ad id, or the start of a name. */
export function classifySearch(raw: string): { kind: SearchKind; value: string } {
  const q = raw.trim();
  if (!q) return { kind: "empty", value: "" };
  if (q.includes("@")) return { kind: "email", value: q.toLowerCase() };
  if (/^[a-f0-9]{24}$/i.test(q)) return { kind: "ad", value: q.toLowerCase() };
  if (/^demo-\d{4}$/i.test(q) || /^tk-?\d+$/i.test(q)) return { kind: "ad", value: q.toLowerCase() };
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 8 && /^[+\d\s()-]+$/.test(q)) return { kind: "phone", value: q };
  return { kind: "name", value: q };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function idsForSearch(raw: string): Promise<Types.ObjectId[] | "none" | null> {
  const { kind, value } = classifySearch(raw);
  if (kind === "empty") return null;
  if (kind === "email") {
    const row = await User.findOne({ email: value }).select("_id").lean();
    return row ? [row._id as Types.ObjectId] : "none";
  }
  if (kind === "phone") {
    const normalized = normalizePhone(value);
    const candidates = Array.from(new Set([normalized, value.trim(), `+${value.replace(/\D/g, "")}`].filter(Boolean)));
    const rows = await PhoneIdentity.find({ phone: { $in: candidates } }).select("userId").limit(MAX_RESULTS_FROM_KEY).lean();
    return rows.length ? rows.map((row) => row.userId) : "none";
  }
  if (kind === "ad") {
    const filter = /^[a-f0-9]{24}$/.test(value) ? { _id: value } : { slug: value };
    const row = await Listing.findOne(filter).select("ownerId").lean();
    return row ? [row.ownerId] : "none";
  }
  if (value.length < NAME_PREFIX_MIN) return "none";
  const rows = await User.find({ displayName: { $regex: `^${escapeRegex(value)}`, $options: "i" } })
    .select("_id")
    .limit(MAX_RESULTS_FROM_KEY)
    .lean();
  return rows.length ? rows.map((row) => row._id as Types.ObjectId) : "none";
}

const MAX_FILTER_IDS = 5000;

/** Owners of at least one live ad (capped, newest first is not needed: the list sorts itself). */
async function idsWithLiveAds(): Promise<Types.ObjectId[]> {
  const owners = (await Listing.distinct("ownerId", { status: "active" })) as Types.ObjectId[];
  return owners.slice(0, MAX_FILTER_IDS);
}

/** People whose wallet holds more than nothing: the sum of every ledger line is above zero (capped). */
async function idsWithCredits(): Promise<Types.ObjectId[]> {
  const rows = await WalletEntry.aggregate<{ _id: Types.ObjectId }>([{ $group: { _id: "$userId", total: { $sum: "$delta" } } }, { $match: { total: { $gt: 0 } } }, { $limit: MAX_FILTER_IDS }, { $project: { _id: 1 } }]);
  return rows.map((row) => row._id);
}

function intersect(first: Types.ObjectId[] | null, second: Types.ObjectId[]): Types.ObjectId[] {
  if (!first) return second;
  const keep = new Set(second.map(String));
  return first.filter((id) => keep.has(String(id)));
}

function tabFilter(tab: UserTab): QueryFilter<UserDoc> {
  if (tab === "sellers") return { sellerProfile: { $type: "object" }, status: { $ne: "deleted" } };
  if (tab === "id") return { verificationStatus: "pending_review", status: { $ne: "deleted" } };
  if (tab === "banned") return { status: "suspended" };
  if (tab === "staff") return { roles: { $in: [...STAFF_ROLE_NAMES] }, status: { $ne: "deleted" } };
  return { status: { $ne: "deleted" } };
}

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: UserDoc["status"];
  roles: string[];
  verification: UserDoc["verificationStatus"];
  city: string | null;
  ads: number;
  lastSeen: string | null;
  createdAt: string | null;
};

export type UserList = { rows: UserRow[]; total: number; counts: Record<UserTab, number>; query: UserQuery };

function requireView(roles: readonly string[]) {
  if (!can(roles, "users.view")) throw new ForbiddenError("You cannot open the Users screen");
}

/** The user list: one tab, one search, one page. Counts for every tab ignore the search. */
export async function listUsers(query: UserQuery, roles: readonly string[]): Promise<UserList> {
  requireView(roles);
  await connectDb();
  const found = await idsForSearch(query.q);
  let ids: Types.ObjectId[] | "none" | null = found;
  if (ids !== "none" && query.ads) ids = intersect(ids, await idsWithLiveAds());
  if (ids !== "none" && query.credits) ids = intersect(ids, await idsWithCredits());
  const filter: QueryFilter<UserDoc> = { ...tabFilter(query.tab) };
  if (ids === "none") filter._id = { $in: [] };
  else if (ids) filter._id = { $in: ids };
  const [total, docs, counts] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Promise.all(USER_TABS.map((tab) => User.countDocuments(tabFilter(tab)))),
  ]);
  const pageIds = docs.map((doc) => doc._id as Types.ObjectId);
  const [adCounts, seen] = await Promise.all([
    Listing.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { ownerId: { $in: pageIds }, status: { $nin: ["deleted", "draft"] } } },
      { $group: { _id: "$ownerId", n: { $sum: 1 } } },
    ]),
    Session.aggregate<{ _id: Types.ObjectId; at: Date }>([
      { $match: { userId: { $in: pageIds } } },
      { $group: { _id: "$userId", at: { $max: "$createdAt" } } },
    ]),
  ]);
  const adMap = new Map(adCounts.map((row) => [String(row._id), row.n]));
  const seenMap = new Map(seen.map((row) => [String(row._id), row.at]));
  const rows: UserRow[] = docs.map((doc) => ({
    id: String(doc._id),
    name: shownName(doc),
    email: doc.email,
    status: doc.status,
    roles: doc.roles ?? [],
    verification: doc.verificationStatus,
    city: doc.sellerProfile?.city ?? null,
    ads: adMap.get(String(doc._id)) ?? 0,
    lastSeen: seenMap.get(String(doc._id))?.toISOString() ?? null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  }));
  return {
    rows,
    total,
    counts: Object.fromEntries(USER_TABS.map((tab, index) => [tab, counts[index]])) as Record<UserTab, number>,
    query,
  };
}

export type VendorView = {
  about: string;
  whatsapp: string | null;
  hidden: boolean;
  availableNow: boolean;
  photo: { id: string; src: string; alt: string } | null;
  /** In coins. null when the viewer may not see money. */
  earnings: { balance: number; requested: number; paid: number } | null;
};

export type UserDetail = {
  user: UserRow & { phone: string | null; seller: boolean; whatsapp: string | null };
  vendor: VendorView | null;
  /** null when the viewer may not see money. */
  balance: number | null;
  ads: { id: string; title: string; status: string; slug: string | null; createdAt: string | null }[];
  tickets: { id: string; number: number; subject: string; status: string; lastMessageAt: string | null }[];
  history: { id: string; summary: string; actorRole: string | null; at: string | null }[];
};

/** One user for the drawer: profile, ads, balance, tickets and the last changes. */
export async function getUserDetail(id: string, roles: readonly string[]): Promise<UserDetail> {
  requireView(roles);
  await connectDb();
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Not found");
  const doc = await User.findById(id).lean();
  if (!doc) throw new NotFoundError("Not found");
  const userId = doc._id as Types.ObjectId;
  const [phone, ads, tickets, events, seen, adCount, balance] = await Promise.all([
    PhoneIdentity.findOne({ userId }).select("phone").lean(),
    Listing.find({ ownerId: userId, status: { $nin: ["deleted"] } }).sort({ createdAt: -1 }).limit(10).select("title status slug createdAt").lean(),
    SupportTicket.find({ ownerId: userId }).sort({ lastMessageAt: -1 }).limit(5).select("number subject status lastMessageAt").lean(),
    AuditEvent.find({ targetType: "user", targetId: String(userId) }).sort({ createdAt: -1 }).limit(5).select("summary action actorRole createdAt").lean(),
    Session.findOne({ userId }).sort({ createdAt: -1 }).select("createdAt").lean(),
    Listing.countDocuments({ ownerId: userId, status: { $nin: ["deleted", "draft"] } }),
    walletBalance(String(userId)),
  ]);
  const vendor = doc.sellerProfile ? await vendorView(doc.sellerProfile, userId, roles) : null;
  return {
    vendor,
    user: {
      id: String(userId),
      name: shownName(doc),
      email: doc.email,
      status: doc.status,
      roles: doc.roles ?? [],
      verification: doc.verificationStatus,
      city: doc.sellerProfile?.city ?? null,
      ads: adCount,
      lastSeen: seen?.createdAt ? new Date(seen.createdAt).toISOString() : null,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
      phone: phone?.phone ?? null,
      seller: Boolean(doc.sellerProfile),
      whatsapp: doc.sellerProfile?.whatsapp ?? null,
    },
    balance,
    ads: ads.map((ad) => ({ id: String(ad._id), title: ad.title, status: ad.status, slug: ad.slug ?? null, createdAt: ad.createdAt ? new Date(ad.createdAt).toISOString() : null })),
    tickets: tickets.map((ticket) => ({ id: String(ticket._id), number: ticket.number, subject: ticket.subject, status: ticket.status, lastMessageAt: ticket.lastMessageAt ? new Date(ticket.lastMessageAt).toISOString() : null })),
    history: events.map((event) => ({ id: String(event._id), summary: event.summary || event.action, actorRole: event.actorRole ?? null, at: event.createdAt ? new Date(event.createdAt).toISOString() : null })),
  };
}

async function vendorView(profile: NonNullable<UserDoc["sellerProfile"]>, userId: Types.ObjectId, roles: readonly string[]): Promise<VendorView> {
  const media = profile.photoMediaId ? await SiteMedia.findById(profile.photoMediaId).select("url alt").lean<{ url: string; alt: string } | null>() : null;
  let earnings: VendorView["earnings"] = null;
  if (can(roles, "wallet.view")) {
    const [balance, rows] = await Promise.all([
      accountBalance("vendor_earnings", String(userId)),
      Withdrawal.aggregate<{ _id: string; coins: number }>([{ $match: { userId, status: { $in: ["requested", "approved", "paid"] } } }, { $group: { _id: "$status", coins: { $sum: "$coins" } } }]),
    ]);
    const by = new Map(rows.map((row) => [row._id, row.coins]));
    earnings = { balance, requested: (by.get("requested") ?? 0) + (by.get("approved") ?? 0), paid: by.get("paid") ?? 0 };
  }
  return {
    about: profile.about ?? "",
    whatsapp: profile.whatsapp ?? null,
    hidden: profile.hidden === true,
    availableNow: profile.availableNow === true,
    photo: media && profile.photoMediaId ? { id: String(profile.photoMediaId), src: media.url, alt: media.alt } : null,
    earnings,
  };
}
