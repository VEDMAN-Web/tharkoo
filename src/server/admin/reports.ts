import type { QueryFilter, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { banUser, refreshAdPages } from "@/server/admin/user-actions";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { removeLiveAd } from "@/server/moderation/decide";
import { paidCreditsFor } from "@/server/moderation/review";
import { Category, Listing, Location, Report, User } from "@/server/models";
import type { ReportDoc, Severity } from "@/server/models/trust";

export type ReportTab = "open" | "legal" | "closed";
export const REPORT_TABS: readonly ReportTab[] = ["open", "legal", "closed"];
export const REPORT_PAGE_SIZES = [25, 50, 100] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_MAX = 120;

export const REASON_LABEL: Record<string, string> = {
  prohibited_content: "Prohibited content",
  trafficking_concern: "Trafficking concern",
  stolen_media: "Photos taken from someone else",
  spam: "Spam",
  fake: "Fake ad",
  duplicate: "Same ad posted again",
  wrong_contact: "Wrong contact details",
  other: "Something else",
};

export type ReportQuery = { tab: ReportTab; q: string; page: number; pageSize: number };

export function parseReportQuery(params: Record<string, string | string[] | undefined>): ReportQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  return {
    tab: (REPORT_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as ReportTab) : "open",
    q: one("q").trim().slice(0, SEARCH_MAX),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (REPORT_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

export type ReportRow = {
  id: string;
  listingId: string;
  title: string;
  category: string;
  city: string;
  reason: string;
  count: number;
  urgent: boolean;
  since: string;
  dueAt: string | null;
  status: string;
  outcome: string | null;
};
export type ReportList = { query: ReportQuery; rows: ReportRow[]; total: number; counts: Record<ReportTab, number> };

const OPEN: ReportDoc["status"][] = ["open", "ack"];
const CLOSED: ReportDoc["status"][] = ["actioned", "dismissed"];
const notLegal = { source: { $ne: "legal" } };
const URGENT: Severity[] = ["S0", "S1"];

function filterFor(tab: ReportTab): QueryFilter<ReportDoc> {
  if (tab === "legal") return { source: "legal", status: { $in: OPEN } };
  if (tab === "closed") return { status: { $in: CLOSED } };
  return { ...notLegal, status: { $in: OPEN } };
}

type Group = { _id: Types.ObjectId; count: number; since: Date; severity: Severity; reason: string };

async function openGroups(): Promise<Group[]> {
  return Report.aggregate<Group>([
    { $match: filterFor("open") },
    { $sort: { severity: 1, createdAt: 1 } },
    { $group: { _id: "$listingId", count: { $sum: 1 }, since: { $min: "$createdAt" }, severity: { $min: "$severity" }, reason: { $first: "$reason" } } },
    { $sort: { severity: 1, since: 1 } },
  ]);
}

export async function reportCounts(): Promise<Record<ReportTab, number>> {
  await connectDb();
  const [open, legal, closed] = await Promise.all([
    Report.distinct("listingId", filterFor("open")).then((ids) => ids.length),
    Report.countDocuments(filterFor("legal")),
    Report.countDocuments(filterFor("closed")),
  ]);
  return { open, legal, closed };
}

type Named = { _id: unknown; name?: string; title?: string };

async function decorate(listingIds: Types.ObjectId[]) {
  const listings = await Listing.find({ _id: { $in: listingIds } })
    .select("title categoryId cityId")
    .lean<{ _id: unknown; title?: string; categoryId?: Types.ObjectId; cityId?: Types.ObjectId }[]>();
  const [cats, places] = await Promise.all([
    Category.find({ _id: { $in: listings.flatMap((row) => (row.categoryId ? [row.categoryId] : [])) } }).select("name").lean<Named[]>(),
    Location.find({ _id: { $in: listings.flatMap((row) => (row.cityId ? [row.cityId] : [])) } }).select("name").lean<Named[]>(),
  ]);
  const byId = new Map(listings.map((row) => [String(row._id), row]));
  const nameOf = (list: Named[], id: unknown) => list.find((item) => String(item._id) === String(id))?.name || "";
  return (id: unknown) => {
    const row = byId.get(String(id));
    return { title: row?.title || "(ad removed)", category: nameOf(cats, row?.categoryId), city: nameOf(places, row?.cityId) };
  };
}

export async function listReports(roles: readonly string[], query: ReportQuery): Promise<ReportList> {
  if (!can(roles, "reports.handle")) throw new ForbiddenError("Only a moderator or admin can handle reports");
  if (query.tab === "legal" && !can(roles, "reports.legal")) throw new ForbiddenError("Only trust and safety or an admin can handle legal takedowns");
  await connectDb();
  const counts = await reportCounts();
  const offset = (query.page - 1) * query.pageSize;
  if (query.tab === "open") {
    const groups = await openGroups();
    const titled = await decorate(groups.map((group) => group._id));
    const wanted = query.q ? groups.filter((group) => titled(group._id).title.toLowerCase().includes(query.q.toLowerCase())) : groups;
    const page = wanted.slice(offset, offset + query.pageSize);
    return {
      query,
      counts,
      total: wanted.length,
      rows: page.map((group) => ({
        id: String(group._id),
        listingId: String(group._id),
        ...titled(group._id),
        reason: REASON_LABEL[group.reason] ?? group.reason,
        count: group.count,
        urgent: URGENT.includes(group.severity),
        since: group.since.toISOString(),
        dueAt: null,
        status: "open",
        outcome: null,
      })),
    };
  }
  const filter = filterFor(query.tab);
  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter).sort(query.tab === "closed" ? { resolvedAt: -1, updatedAt: -1 } : { createdAt: 1 }).skip(offset).limit(query.pageSize).lean(),
  ]);
  const titled = await decorate(reports.map((report) => report.listingId));
  return {
    query,
    counts,
    total,
    rows: reports.map((report) => ({
      id: String(report._id),
      listingId: String(report.listingId),
      ...titled(report.listingId),
      reason: report.source === "legal" ? "Legal request" : (REASON_LABEL[report.reason] ?? report.reason),
      count: 1,
      urgent: false,
      since: new Date(report.createdAt ?? Date.now()).toISOString(),
      dueAt: report.source === "legal" ? new Date(report.slaAckDueAt ?? new Date(report.createdAt ?? Date.now()).getTime() + DAY_MS).toISOString() : null,
      status: report.status,
      outcome: report.status === "actioned" ? "Action taken" : report.status === "dismissed" ? "Dismissed" : null,
    })),
  };
}

export type ReportDetail = {
  id: string;
  listingId: string;
  tab: ReportTab;
  title: string;
  adStatus: string;
  seller: string;
  sellerId: string;
  sellerAds: number;
  paidCredits: number;
  liveSince: string | null;
  earlier: number;
  legal: boolean;
  reports: { id: string; reason: string; details: string; since: string; status: string }[];
};

export async function getReportDetail(roles: readonly string[], tab: ReportTab, id: string): Promise<ReportDetail> {
  if (!can(roles, "reports.handle")) throw new ForbiddenError("Only a moderator or admin can handle reports");
  await connectDb();
  const single = tab === "open" ? null : await Report.findById(id).lean();
  const listingId = tab === "open" ? id : single ? String(single.listingId) : "";
  const listing = listingId ? await Listing.findById(listingId).lean() : null;
  if (!listing) throw new NotFoundError("Report not found");
  const reports = tab === "open" ? await Report.find({ listingId: listing._id, ...filterFor("open") }).sort({ createdAt: 1 }).lean() : single ? [single] : [];
  if (reports.length === 0) throw new NotFoundError("Report not found");
  const [owner, sellerAds, paid, earlier] = await Promise.all([
    User.findById(listing.ownerId).select("displayName").lean<{ displayName?: string } | null>(),
    Listing.countDocuments({ ownerId: listing.ownerId, status: { $in: ["active", "pending", "paused"] } }),
    paidCreditsFor([String(listing._id)]),
    Report.countDocuments({ listingId: listing._id, status: { $in: CLOSED }, _id: { $nin: reports.map((report) => report._id) } }),
  ]);
  return {
    id,
    listingId: String(listing._id),
    tab,
    title: listing.title || "",
    adStatus: listing.status || "",
    seller: owner?.displayName || "unknown",
    sellerId: String(listing.ownerId),
    sellerAds,
    paidCredits: paid.get(String(listing._id)) ?? 0,
    liveSince: listing.publishedAt ? new Date(listing.publishedAt).toISOString() : null,
    earlier,
    legal: reports.some((report) => report.source === "legal"),
    reports: reports.map((report) => ({
      id: String(report._id),
      reason: report.source === "legal" ? "Legal takedown request" : (REASON_LABEL[report.reason] ?? report.reason),
      details: [report.source === "legal" && report.askedBy ? `Asked by ${report.askedBy}${report.channel ? `, by ${report.channel}` : ""}.` : "", report.details || ""].filter(Boolean).join(" "),
      since: new Date(report.createdAt ?? Date.now()).toISOString(),
      status: report.status,
    })),
  };
}

export type ReportAction = "dismiss" | "pause" | "remove" | "removeBan" | "ack" | "close" | "reopen";
export type ActInput = { tab: ReportTab; id: string; action: ReportAction; note: string; refund: boolean };
export type ActResult = { eventIds: string[]; undoUntil: string | null; summary: string };

type Snap = { status: string; ackAt: string | null; resolvedAt: string | null };
const snap = (doc: { status?: string; ackAt?: Date; resolvedAt?: Date }): Snap => ({ status: doc.status ?? "open", ackAt: doc.ackAt ? new Date(doc.ackAt).toISOString() : null, resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).toISOString() : null });

const OUTCOME: Record<"dismiss" | "pause" | "remove" | "removeBan" | "ack" | "close" | "reopen", { status: "open" | "ack" | "actioned" | "dismissed"; words: string }> = {
  dismiss: { status: "dismissed", words: "Dismissed the reports" },
  pause: { status: "actioned", words: "Paused the ad" },
  remove: { status: "actioned", words: "Removed the ad" },
  removeBan: { status: "actioned", words: "Removed the ad and banned the seller" },
  ack: { status: "ack", words: "Acknowledged the legal request" },
  close: { status: "dismissed", words: "Closed the legal request without action" },
  reopen: { status: "open", words: "Reopened the report" },
};

async function targets(tab: ReportTab, id: string) {
  await connectDb();
  if (tab === "open") {
    const reports = await Report.find({ listingId: id, ...filterFor("open") }).lean();
    return { reports, listingId: id };
  }
  const report = await Report.findById(id).lean();
  if (!report) throw new NotFoundError("Report not found");
  return { reports: [report], listingId: String(report.listingId) };
}

/** One decision on the reports of an ad (or on one legal or closed report). The ad is taken down with the A18 helpers; the reports are closed here, and both can be undone. */
export async function actOnReports(ctx: AdminCtx, input: ActInput): Promise<ActResult> {
  const rule = OUTCOME[input.action];
  if (!rule) throw new ValidationError("Choose what to do with the report");
  await connectDb();
  const { reports, listingId } = await targets(input.tab, input.id);
  if (reports.length === 0) throw new NotFoundError("Report not found");
  const legal = reports.some((report) => report.source === "legal");
  const perm = legal ? "reports.legal" : "reports.handle";
  const note = input.note.trim().slice(0, 500);
  if (["remove", "removeBan", "pause"].includes(input.action) && !can(ctx.roles, "ads.decide")) throw new ForbiddenError("Only a moderator or admin can take an ad down");
  if (input.action === "removeBan" && !can(ctx.roles, "users.ban")) throw new ForbiddenError("Only trust and safety or an admin can ban a seller");
  if (input.action === "reopen" && !reports.every((report) => CLOSED.includes(report.status))) throw new ConflictError("This report is not closed");
  if (["ack", "close", "dismiss"].includes(input.action) && !reports.every((report) => OPEN.includes(report.status))) throw new ConflictError("This report is already closed");
  const listing = await Listing.findById(listingId);
  if (["pause", "remove", "removeBan"].includes(input.action) && (!listing || listing.status !== "active")) throw new ConflictError(`This ad is ${listing?.status ?? "gone"}, not live`);
  const eventIds: string[] = [];
  let summary = rule.words;
  let undoUntil: string | null = null;

  if (input.action === "remove" || input.action === "removeBan") {
    const reason = note || (REASON_LABEL[reports[0].reason] ?? "Reported by users");
    const removed = await removeLiveAd({ id: listingId, roles: ctx.roles, email: ctx.email, reason, refund: input.refund === true });
    eventIds.push(removed.eventId);
    undoUntil = removed.undoUntil;
    if (removed.refunded > 0) summary += `, ${removed.refunded} credits given back`;
  }

  const closing = await adminWrite<{ count: number }>(ctx, {
    perm,
    action: `report.${input.action}`,
    target: { type: "listing", id: listingId, label: listing?.title },
    reason: note || undefined,
    texts: note,
    undo: { kind: "report.decision", windowKey: "decisions" },
    before: async () => ({ statuses: reports.map((report) => report.status) }),
    apply: async () => {
      const was = reports.map((report) => ({ id: String(report._id), ...snap(report) }));
      const now = new Date();
      const set: Record<string, unknown> = { status: rule.status, decidedBy: ctx.actorId || undefined, ...(note ? { note } : {}) };
      if (rule.status === "ack") set.ackAt = now;
      if (rule.status === "actioned" || rule.status === "dismissed") set.resolvedAt = now;
      const update: Record<string, unknown> = { $set: set };
      if (rule.status === "open") update.$unset = { resolvedAt: "", ackAt: "" };
      await Report.updateMany({ _id: { $in: reports.map((report) => report._id) } }, update);
      let listingMove: { id: string; was: string; now: string } | null = null;
      if (input.action === "pause" && listing) {
        listing.status = "paused";
        await listing.save();
        listingMove = { id: listingId, was: "active", now: "paused" };
        await refreshAdPages([listingId]);
      }
      return {
        after: { status: rule.status, reports: reports.length },
        result: { count: reports.length },
        summary: rule.words,
        undoData: {
          reports: was.map((entry) => ({ id: entry.id, was: { status: entry.status, ackAt: entry.ackAt, resolvedAt: entry.resolvedAt }, now: { status: rule.status, ackAt: rule.status === "ack" ? now.toISOString() : entry.ackAt, resolvedAt: rule.status === "actioned" || rule.status === "dismissed" ? now.toISOString() : null } })),
          listing: listingMove,
        },
      };
    },
  });
  eventIds.push(closing.eventId);
  undoUntil = undoUntil ?? closing.undoUntil;

  if (input.action === "removeBan" && listing) {
    const banned = await banUser(ctx, { userId: String(listing.ownerId), reason: note || "Banned after a report" });
    eventIds.push(banned.eventId);
    summary = `${rule.words}. ${banned.summary}`;
  }
  return { eventIds, undoUntil, summary };
}
