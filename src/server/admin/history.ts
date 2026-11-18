import type { QueryFilter, Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { actionWords as plainAction, plainSentence, targetWords } from "@/lib/admin/history-words";
import { roleWords } from "@/lib/admin/role-words";
import type { AdminCtx } from "@/server/admin/context";
import { isUndoKind, loadUndoHandler, safeUndoData, undoSourceOf, UndoNotBuiltError, type LockReason } from "@/server/admin/undo/registry";
import { ForbiddenError } from "@/server/http";
import { AuditEvent, User } from "@/server/models";
import type { AuditEventDoc } from "@/server/models/trust";
import { HISTORY_DAYS, HISTORY_PAGE_SIZES, TYPE_LABELS, TYPE_PATTERNS, typeOfAction, type HistoryTab, type TypeKey } from "@/server/admin/history-rules";

export { HISTORY_DAYS, HISTORY_PAGE_SIZES, TYPE_LABELS, typeOfAction };
export type { HistoryTab, TypeKey };

/** H8.26 (A26): the History & undo screen. Recent changes by staff, the full audit log, a CSV export and the history of one record. */

export const LOCK_LABELS: Record<LockReason, string> = {
  money_sent: "Money sent",
  message_sent: "Message sent",
  purged: "Deleted for good",
  legal_record: "Legal record",
  account_deleted: "Account deleted",
};


const DAY_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 600;
const EXPORT_LIMIT = 5000;
const SEARCH_MAX = 120;
const ACTOR_LIMIT = 40;
export type HistoryQuery = { tab: HistoryTab; q: string; who: string; type: TypeKey | ""; days: number; mine: boolean; page: number; pageSize: number };

export function parseHistoryQuery(params: Record<string, string | string[] | undefined>): HistoryQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const days = one("days") === "" ? 7 : Number(one("days"));
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  const type = one("type");
  return {
    tab: one("tab") === "audit" ? "audit" : "recent",
    q: one("q").trim().slice(0, SEARCH_MAX),
    who: /^[a-f0-9]{24}$/i.test(one("who")) ? one("who") : "",
    type: (Object.keys(TYPE_LABELS) as TypeKey[]).includes(type as TypeKey) ? (type as TypeKey) : "",
    days: (HISTORY_DAYS as readonly number[]).includes(days) ? days : 7,
    mine: one("mine") === "1",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (HISTORY_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

export type RowState = "can_undo" | "restore" | "undone" | "locked" | "expired" | "not_yours" | "not_built" | "none";

export interface HistoryRow {
  id: string;
  title: string;
  label: string;
  who: string;
  role: string;
  at: string;
  type: TypeKey;
  state: RowState;
  /** The audit row the button acts on: the change itself, or for Redo the undo that took it back. */
  actionId: string | null;
  actionLabel: string | null;
  lock: { reason: LockReason; text: string } | null;
  reason: string;
}

export interface HistoryList {
  query: HistoryQuery;
  rows: HistoryRow[];
  total: number;
  actors: { id: string; name: string }[];
  canSeeAudit: boolean;
}

type Row = AuditEventDoc & { _id: Types.ObjectId };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function baseFilter(query: HistoryQuery, now: Date): QueryFilter<AuditEventDoc> {
  const filter: QueryFilter<AuditEventDoc> = {};
  if (query.tab === "recent") {
    filter.summary = { $exists: true, $ne: "" };
    filter.action = { $ne: "admin.write.denied" };
  }
  if (query.days > 0) filter.createdAt = { $gte: new Date(now.getTime() - query.days * DAY_MS) };
  if (query.who) filter.actorId = query.who;
  if (query.type && query.type !== "other") filter.action = { ...(filter.action as object | undefined), $regex: TYPE_PATTERNS[query.type].source };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ targetLabel: pattern }, { summary: pattern }, { action: pattern }, { targetId: pattern }];
  }
  return filter;
}

async function namesOf(ids: (Types.ObjectId | null | undefined)[]) {
  const wanted = Array.from(new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String)));
  if (wanted.length === 0) return new Map<string, string>();
  const users = await User.find({ _id: { $in: wanted } }).select("displayName").lean<{ _id: Types.ObjectId; displayName?: string }[]>();
  return new Map(users.map((user) => [String(user._id), user.displayName ?? "Staff"]));
}

/** For each row: the latest undo of it, and whether that undo was itself undone (a redo). */
async function undoLinks(rows: Row[]) {
  const ids = rows.map((row) => row._id);
  const links = await AuditEvent.find({ undoOf: { $in: ids } }).sort({ _id: 1 }).select("_id undoOf").lean<{ _id: Types.ObjectId; undoOf: Types.ObjectId }[]>();
  const latest = new Map<string, string>();
  for (const link of links) latest.set(String(link.undoOf), String(link._id));
  const redone = await AuditEvent.find({ undoOf: { $in: Array.from(latest.values()) } }).select("undoOf").lean<{ undoOf: Types.ObjectId }[]>();
  return { latest, redone: new Set(redone.map((row) => String(row.undoOf))) };
}

function actionWords(row: Row): string {
  const data = row.undo?.data as { restoreVersion?: unknown } | undefined;
  if (row.undo?.kind === "layout.publish" && typeof data?.restoreVersion === "number") return `Restore v${data.restoreVersion}`;
  if (row.action === "user.ban") return "Unban";
  return "Undo";
}

async function allowed(ctx: AdminCtx, row: Row): Promise<"yes" | "no" | "not_built"> {
  if (!row.undo || !isUndoKind(row.undo.kind)) return "no";
  try {
    const handler = await loadUndoHandler(row.undo.kind);
    const source = undoSourceOf({ id: String(row._id), action: row.action, targetType: row.targetType, targetId: row.targetId, actorId: row.actorId ? String(row.actorId) : null, undoOf: row.undoOf ? String(row.undoOf) : null, createdAt: row.createdAt ?? new Date(0) }, row.undo.data);
    return (await handler.canUndo(ctx, source)) ? "yes" : "no";
  } catch (error) {
    if (error instanceof UndoNotBuiltError) return "not_built";
    return "no";
  }
}

async function toRows(ctx: AdminCtx, rows: Row[], now: Date): Promise<HistoryRow[]> {
  const [names, links] = await Promise.all([namesOf(rows.map((row) => row.actorId)), undoLinks(rows)]);
  const out: HistoryRow[] = [];
  for (const row of rows) {
    const id = String(row._id);
    const undoId = links.latest.get(id);
    const undone = Boolean(undoId) && !links.redone.has(undoId as string);
    const open = Boolean(row.undo && new Date(row.undo.until).getTime() > now.getTime());
    let state: RowState = "none";
    let actionId: string | null = null;
    let actionLabel: string | null = null;
    if (row.undoOf) state = "none";
    else if (row.lock) state = "locked";
    else if (undone) {
      state = "undone";
      actionId = undoId ?? null;
      actionLabel = "Redo";
    } else if (row.undo && !open) state = "expired";
    else if (row.undo) {
      const verdict = await allowed(ctx, row);
      state = verdict === "yes" ? (row.undo.kind === "layout.publish" ? "restore" : "can_undo") : verdict === "not_built" ? "not_built" : "not_yours";
      if (verdict === "yes") {
        actionId = id;
        actionLabel = actionWords(row);
      }
    }
    out.push({
      id,
      title: plainSentence(row.summary || plainAction(row.action), now),
      label: row.targetLabel || (row.targetType ? targetWords(row.targetType) : ""),
      who: row.actorId ? (names.get(String(row.actorId)) ?? "Staff") : row.actorType === "system" ? "The system" : row.actorType === "admin" ? "Staff" : "A visitor",
      role: row.actorRole ? roleWords([row.actorRole]) : "",
      at: (row.createdAt ?? now).toISOString(),
      type: typeOfAction(row.action),
      state,
      actionId,
      actionLabel,
      lock: row.lock ? { reason: row.lock, text: LOCK_LABELS[row.lock] } : null,
      reason: row.reason ?? "",
    });
  }
  return out;
}

async function actorsFor(filter: QueryFilter<AuditEventDoc>) {
  const ids = await AuditEvent.distinct("actorId", { ...filter, actorId: { $ne: null } });
  const names = await namesOf((ids as Types.ObjectId[]).slice(0, ACTOR_LIMIT));
  return Array.from(names.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Recent changes (summaries only) or the full audit log (every row, admins only), newest first. */
export async function listHistory(ctx: AdminCtx, query: HistoryQuery, now: Date = new Date()): Promise<HistoryList> {
  await connectDb();
  if (!can(ctx.roles, "history.view")) throw new ForbiddenError("You cannot open History & undo");
  const canSeeAudit = can(ctx.roles, "settings.edit");
  if (query.tab === "audit" && !canSeeAudit) throw new ForbiddenError("Only an admin can read the full audit log");
  const filter = baseFilter(query, now);
  const actors = await actorsFor(baseFilter({ ...query, who: "", q: "", type: "" }, now));
  if (query.tab === "recent" && query.mine) {
    const open = { ...filter, "undo.until": { $gt: now }, lock: { $exists: false }, undoOf: { $exists: false } };
    const candidates = await AuditEvent.find(open).sort({ createdAt: -1 }).limit(CANDIDATE_LIMIT).lean<Row[]>();
    const rows = (await toRows(ctx, candidates, now)).filter((row) => row.state === "can_undo" || row.state === "restore");
    const start = (query.page - 1) * query.pageSize;
    return { query, rows: rows.slice(start, start + query.pageSize), total: rows.length, actors, canSeeAudit };
  }
  const [total, found] = await Promise.all([
    AuditEvent.countDocuments(filter),
    AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean<Row[]>(),
  ]);
  return { query, rows: await toRows(ctx, found, now), total, actors, canSeeAudit };
}

export interface HistoryDetail {
  row: HistoryRow;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Earlier changes to the same record, newest first, without this one. */
  earlier: HistoryRow[];
}

/** What one change did, field by field: the before and after saved on the audit row (secrets are never saved there), and the record's earlier changes. */
export async function historyDetail(ctx: AdminCtx, id: string, now: Date = new Date()): Promise<HistoryDetail | null> {
  await connectDb();
  if (!can(ctx.roles, "history.view")) throw new ForbiddenError("You cannot open History & undo");
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const found = await AuditEvent.findById(id).lean<Row | null>();
  if (!found) return null;
  const [row] = await toRows(ctx, [found], now);
  const earlier = await recordHistory(ctx, { targetType: found.targetType, targetId: found.targetId }, 8, now, { at: found.createdAt ?? now, id: found._id });
  return {
    row,
    before: (safeUndoData(found.before) as Record<string, unknown> | undefined) ?? null,
    after: (safeUndoData(found.after) as Record<string, unknown> | undefined) ?? null,
    earlier,
  };
}

/** Every logged change to one record, newest first. Used by the History drawer of an ad, a user or a page. With `olderThan`, only the changes made before that one. */
export async function recordHistory(ctx: AdminCtx, input: { targetType: string; targetId: string }, limit = 50, now: Date = new Date(), olderThan?: { at: Date; id: unknown }): Promise<HistoryRow[]> {
  await connectDb();
  if (!can(ctx.roles, "history.view")) throw new ForbiddenError("You cannot open History & undo");
  const filter: Record<string, unknown> = { targetType: input.targetType, targetId: input.targetId, summary: { $exists: true, $ne: "" } };
  if (olderThan) filter.$or = [{ createdAt: { $lt: olderThan.at } }, { createdAt: olderThan.at, _id: { $lt: olderThan.id } }];
  const found = await AuditEvent.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(limit, 200))
    .lean<Row[]>();
  return toRows(ctx, found, now);
}

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The current filter as a CSV file (up to 5,000 rows). A cell that starts like a formula is quoted with a leading apostrophe. */
export async function historyCsv(ctx: AdminCtx, query: HistoryQuery, now: Date = new Date()): Promise<string> {
  await connectDb();
  if (!can(ctx.roles, "history.view")) throw new ForbiddenError("You cannot open History & undo");
  if (query.tab === "audit" && !can(ctx.roles, "settings.edit")) throw new ForbiddenError("Only an admin can export the full audit log");
  const found = await AuditEvent.find(baseFilter(query, now)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_LIMIT).lean<Row[]>();
  const names = await namesOf(found.map((row) => row.actorId));
  const lines = [["When (UTC)", "Who", "Role", "What", "Record", "Type", "Reason", "Locked"].join(",")];
  for (const row of found) {
    lines.push(
      [
        (row.createdAt ?? now).toISOString(),
        row.actorId ? (names.get(String(row.actorId)) ?? "Staff") : row.actorType,
        row.actorRole ?? "",
        plainSentence(row.summary || plainAction(row.action), now),
        row.targetLabel || (row.targetType ? targetWords(row.targetType) : ""),
        typeOfAction(row.action),
        row.reason ?? "",
        row.lock ? LOCK_LABELS[row.lock] : "",
      ]
        .map((cell) => csvCell(String(cell)))
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
