import { Types } from "mongoose";
import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { KIND_PERM, NOTIFICATION_KINDS, type NotificationItem, type NotificationKind } from "@/lib/admin/notification-kinds";
import { RECHARGE_CHECK_AFTER_MS } from "@/server/admin/counts";
import { demoFilter } from "@/server/listings/demo-ads";
import { IdentityVerification, Listing, Payment, Report, Site, User } from "@/server/models";
import { StaffNotificationMark, StaffNotificationRead } from "@/server/models/notifications";
import { SupportTicket } from "@/server/models/support";
import { COUNTS_TAG, unseenTicketFilter } from "@/server/support/unseen";
import { Withdrawal } from "@/server/wallet/withdrawals";

/**
 * H8.53: the bell. A list of things staff must act on, newest first, built from the queues that already exist
 * (nothing in a queue is changed) and filtered to what the person's role may see. What each person has read is kept apart.
 */

const PER_KIND_LIMIT = 100;
const SOURCE_TTL_MS = 10_000;
const TITLE_MAX = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
export const BELL_PAGE_SIZE = 20;
export const PANEL_SIZE = 8;

type Raw = Omit<NotificationItem, "unread" | "at" | "due"> & { at: Date; due: Date | null };

export { KIND_LABEL, KIND_PERM, NOTIFICATION_KINDS, isKind, type NotificationItem, type NotificationKind } from "@/lib/admin/notification-kinds";

export function kindsForRoles(roles: readonly string[] | undefined): NotificationKind[] {
  return NOTIFICATION_KINDS.filter((kind) => can(roles, KIND_PERM[kind]));
}

const short = (text: string | undefined) => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1)}...` : clean || "(no title)";
};
const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

type TitleRow = { _id: unknown; title?: string };

async function titlesOf(ids: (Types.ObjectId | string)[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await Listing.find({ _id: { $in: ids } }).select("title").lean<TitleRow[]>();
  return new Map(rows.map((row) => [String(row._id), short(row.title)]));
}

async function notDemo() {
  const demo = await demoFilter();
  return demo ? { $nor: [demo] } : {};
}

async function adItems(): Promise<Raw[]> {
  const skip = await notDemo();
  const site = await Site.findOne().select("postModerationSince").lean<{ postModerationSince?: Date | null } | null>();
  const since = site?.postModerationSince;
  const [held, unchecked] = await Promise.all([
    Listing.find({ ...skip, status: "pending" }).sort({ createdAt: -1 }).limit(PER_KIND_LIMIT).select("title createdAt").lean<(TitleRow & { createdAt?: Date })[]>(),
    since
      ? Listing.find({ ...skip, status: "active", lastModerationAt: { $exists: false }, publishedAt: { $gt: since } })
          .sort({ publishedAt: -1 })
          .limit(PER_KIND_LIMIT)
          .select("title publishedAt")
          .lean<(TitleRow & { publishedAt?: Date })[]>()
      : Promise.resolve([] as (TitleRow & { publishedAt?: Date })[]),
  ]);
  return [
    ...held.map((row): Raw => ({ key: `ad:${row._id}`, kind: "ad", text: `Ad held for review: '${short(row.title)}'`, at: row.createdAt ?? new Date(0), href: `/admin/moderation/?tab=held&open=${row._id}`, due: null })),
    ...unchecked.map((row): Raw => ({ key: `ad:${row._id}`, kind: "ad", text: `New ad to check: '${short(row.title)}'`, at: row.publishedAt ?? new Date(0), href: `/admin/moderation/?tab=live&open=${row._id}`, due: null })),
  ];
}

async function reportItems(): Promise<Raw[]> {
  const rows = await Report.find({ status: { $in: ["open", "ack"] }, source: { $ne: "legal" } })
    .sort({ createdAt: -1 })
    .limit(PER_KIND_LIMIT * 3)
    .select("listingId createdAt")
    .lean<{ listingId: Types.ObjectId; createdAt?: Date }[]>();
  const newest = new Map<string, Date>();
  for (const row of rows) if (!newest.has(String(row.listingId))) newest.set(String(row.listingId), row.createdAt ?? new Date(0));
  const ids = [...newest.keys()].slice(0, PER_KIND_LIMIT);
  const titles = await titlesOf(ids);
  return ids.map((id): Raw => ({ key: `report:${id}`, kind: "report", text: `New report on '${titles.get(id) ?? "(ad removed)"}'`, at: newest.get(id) as Date, href: `/admin/reports/?open=${id}`, due: null }));
}

async function legalItems(): Promise<Raw[]> {
  const rows = await Report.find({ source: "legal", status: { $in: ["open", "ack"] } })
    .sort({ createdAt: -1 })
    .limit(PER_KIND_LIMIT)
    .select("listingId createdAt slaAckDueAt")
    .lean<{ _id: Types.ObjectId; listingId: Types.ObjectId; createdAt?: Date; slaAckDueAt?: Date }[]>();
  const titles = await titlesOf(rows.map((row) => row.listingId));
  return rows.map((row): Raw => {
    const at = row.createdAt ?? new Date(0);
    return { key: `legal:${row._id}`, kind: "legal", text: `Legal takedown request on '${titles.get(String(row.listingId)) ?? "(ad removed)"}'`, at, href: `/admin/reports/?tab=legal&open=${row._id}`, due: row.slaAckDueAt ?? new Date(at.getTime() + DAY_MS) };
  });
}

async function idItems(): Promise<Raw[]> {
  const rows = await IdentityVerification.find({ status: "pending_review" }).sort({ createdAt: -1 }).limit(PER_KIND_LIMIT).select("userId createdAt").lean<{ _id: Types.ObjectId; userId: Types.ObjectId; createdAt?: Date }[]>();
  const people = await User.find({ _id: { $in: rows.map((row) => row.userId) } }).select("displayName").lean<{ _id: unknown; displayName?: string }[]>();
  const names = new Map(people.map((row) => [String(row._id), row.displayName || "a member"]));
  return rows.map((row): Raw => ({ key: `idcheck:${row._id}`, kind: "idcheck", text: `New ID check from ${short(names.get(String(row.userId)) ?? "a member")}`, at: row.createdAt ?? new Date(0), href: `/admin/kyc/?open=${row._id}`, due: null }));
}

async function ticketItems(): Promise<Raw[]> {
  const rows = await SupportTicket.find(unseenTicketFilter())
    .sort({ lastCustomerMessageAt: -1 })
    .limit(PER_KIND_LIMIT)
    .select("number subject lastCustomerMessageAt lastStaffViewAt")
    .lean<{ _id: Types.ObjectId; number: number; subject: string; lastCustomerMessageAt: Date; lastStaffViewAt?: Date | null }[]>();
  return rows.map((row): Raw => ({
    key: `ticket:${row._id}`,
    kind: "ticket",
    text: row.lastStaffViewAt ? `New reply on ticket #${row.number}: '${short(row.subject)}'` : `New support ticket: '${short(row.subject)}'`,
    at: row.lastCustomerMessageAt,
    href: `/admin/support/?ticket=${row._id}`,
    due: null,
  }));
}

async function paymentItems(): Promise<Raw[]> {
  const rows = await Payment.find({ status: "pending", provider: { $ne: "mock" }, createdAt: { $lt: new Date(Date.now() - RECHARGE_CHECK_AFTER_MS) } })
    .sort({ createdAt: -1 })
    .limit(PER_KIND_LIMIT)
    .select("amount createdAt")
    .lean<{ _id: Types.ObjectId; amount: number; createdAt?: Date }[]>();
  return rows.map((row): Raw => ({ key: `payment:${row._id}`, kind: "payment", text: `Payment of ${rupees(row.amount)} is stuck waiting`, at: new Date((row.createdAt ?? new Date(0)).getTime() + RECHARGE_CHECK_AFTER_MS), href: `/admin/finance/?tab=recharges&open=${row._id}`, due: null }));
}

async function payoutItems(): Promise<Raw[]> {
  const rows = await Withdrawal.find({ status: "requested" }).sort({ createdAt: -1 }).limit(PER_KIND_LIMIT).select("amountInr createdAt").lean<{ _id: Types.ObjectId; amountInr: number; createdAt?: Date }[]>();
  return rows.map((row): Raw => ({ key: `payout:${row._id}`, kind: "payout", text: `Payout of ${rupees(row.amountInr)} asked for`, at: row.createdAt ?? new Date(0), href: `/admin/finance/?tab=payouts&open=${row._id}`, due: null }));
}

const SOURCES: Record<NotificationKind, () => Promise<Raw[]>> = {
  ad: adItems,
  report: reportItems,
  legal: legalItems,
  idcheck: idItems,
  ticket: ticketItems,
  payment: paymentItems,
  payout: payoutItems,
};

/** The newest items of the given kinds, the same for everyone who may see them. Kept for a few seconds and cleared when a ticket is opened or closed. */
async function sharedFeed(kinds: readonly NotificationKind[]): Promise<Raw[]> {
  await connectDb();
  if (kinds.length === 0) return [];
  return cached(`admin-bell:${kinds.join(",")}`, SOURCE_TTL_MS, async () => {
    const lists = await Promise.all(kinds.map((kind) => SOURCES[kind]()));
    return lists.flat().sort((a, b) => b.at.getTime() - a.at.getTime() || a.key.localeCompare(b.key));
  }, [COUNTS_TAG]);
}

type ReadState = { before: Date | null; reads: Map<string, Date> };

async function readStateOf(staffId: string): Promise<ReadState> {
  await connectDb();
  const id = new Types.ObjectId(staffId);
  const [mark, reads] = await Promise.all([
    StaffNotificationMark.findOne({ staffId: id }).lean<{ allReadBefore: Date } | null>(),
    StaffNotificationRead.find({ staffId: id }).lean<{ itemKey: string; readAt: Date }[]>(),
  ]);
  return { before: mark?.allReadBefore ?? null, reads: new Map(reads.map((row) => [row.itemKey, row.readAt])) };
}

function isUnread(item: Raw, state: ReadState): boolean {
  if (state.before && item.at.getTime() <= state.before.getTime()) return false;
  const read = state.reads.get(item.key);
  return !(read && item.at.getTime() <= read.getTime());
}

export type NotificationQuery = { unreadOnly?: boolean; kind?: NotificationKind | ""; page?: number; pageSize?: number };
export type NotificationPage = { now: number; items: NotificationItem[]; total: number; unread: number; page: number; pageSize: number; kinds: NotificationKind[] };

/** One person's list. Only kinds their role may see; a kind they may not see is never read from the database for them. */
export async function listNotifications(staffId: string, roles: readonly string[], query: NotificationQuery = {}): Promise<NotificationPage> {
  await connectDb();
  const kinds = kindsForRoles(roles);
  const [feed, state] = await Promise.all([sharedFeed(kinds), readStateOf(staffId)]);
  const marked = feed.map((item) => ({ item, unread: isUnread(item, state) }));
  const unread = marked.filter((row) => row.unread).length;
  const wanted = marked.filter((row) => (!query.kind || row.item.kind === query.kind) && (!query.unreadOnly || row.unread));
  const pageSize = Math.max(1, Math.min(query.pageSize ?? BELL_PAGE_SIZE, 50));
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const slice = wanted.slice((page - 1) * pageSize, page * pageSize);
  return {
    now: Date.now(),
    items: slice.map(({ item, unread: isNew }) => ({ key: item.key, kind: item.kind, text: item.text, at: item.at.toISOString(), href: item.href, due: item.due ? item.due.toISOString() : null, unread: isNew })),
    total: wanted.length,
    unread,
    page,
    pageSize,
    kinds,
  };
}

/** The number on the bell for one person. */
export async function unreadNotificationCount(staffId: string, roles: readonly string[]): Promise<number> {
  await connectDb();
  return (await listNotifications(staffId, roles, { pageSize: 1 })).unread;
}

const KEY_PATTERN = /^(ad|report|legal|idcheck|ticket|payment|payout):[0-9a-f]{24}$/;

/** Marks one item read for this person only. A key of a kind the role may not see is refused. */
export async function markNotificationRead(staffId: string, roles: readonly string[], itemKey: string, now = new Date()): Promise<boolean> {
  await connectDb();
  if (!KEY_PATTERN.test(itemKey)) return false;
  const kind = itemKey.split(":")[0] as NotificationKind;
  if (!can(roles, KIND_PERM[kind])) return false;
  await StaffNotificationRead.updateOne({ staffId: new Types.ObjectId(staffId), itemKey }, { $set: { readAt: now } }, { upsert: true });
  return true;
}

/** Everything that has appeared so far counts as read for this person. Later items stay unread. */
export async function markAllNotificationsRead(staffId: string, now = new Date()): Promise<void> {
  await connectDb();
  await StaffNotificationMark.updateOne({ staffId: new Types.ObjectId(staffId) }, { $set: { allReadBefore: now } }, { upsert: true });
}
