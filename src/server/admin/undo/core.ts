import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository, redact } from "@/server/audit";
import type { AdminCtx } from "@/server/admin/context";
import { isUndoKind, loadUndoHandler, UndoNotBuiltError, type LockReason, type UndoSource } from "@/server/admin/undo/registry";
import { AuditEvent } from "@/server/models";

const audit = new AuditRepository();
const MAX_LINKS = 3;

export type UndoOutcome =
  | { ok: true; eventId: string; undoUntil: string | null }
  | { ok: false; reason: "not_found" | "not_undoable" | "expired" | "already_undone" | "not_allowed" | "not_built"; message: string }
  | { ok: false; reason: "locked"; message: string; lock: LockReason }
  | { ok: false; reason: "conflict"; message: string; changedBy: string | null; at: string };

type EventRow = {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  undo?: { kind: string; until: Date; data?: unknown };
  lock?: LockReason;
  undoOf?: Types.ObjectId;
  createdAt?: Date;
};

async function isUndone(id: Types.ObjectId, depth = 0): Promise<boolean> {
  const link = await AuditEvent.findOne({ undoOf: id }).sort({ _id: -1 }).select("_id").lean<{ _id: Types.ObjectId } | null>();
  if (!link) return false;
  if (depth + 1 >= MAX_LINKS) return true;
  return !(await isUndone(link._id, depth + 1));
}

function sourceOf(row: EventRow): UndoSource {
  return {
    id: String(row._id),
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    actorId: row.actorId ? String(row.actorId) : null,
    before: row.before ?? null,
    after: row.after ?? null,
    data: row.undo?.data,
    undoOf: row.undoOf ? String(row.undoOf) : null,
    createdAt: row.createdAt ?? new Date(0),
  };
}

export async function eventIsUndone(eventId: string): Promise<boolean> {
  await connectDb();
  return Types.ObjectId.isValid(eventId) ? isUndone(new Types.ObjectId(eventId)) : false;
}

export async function undoEvent(ctx: AdminCtx, eventId: string): Promise<UndoOutcome> {
  await connectDb();
  if (!Types.ObjectId.isValid(eventId)) return { ok: false, reason: "not_found", message: "This change was not found" };
  const row = await AuditEvent.findById(eventId).lean<EventRow | null>();
  if (!row) return { ok: false, reason: "not_found", message: "This change was not found" };
  if (row.lock) return { ok: false, reason: "locked", lock: row.lock, message: "This change cannot be undone" };
  if (!row.undo || !isUndoKind(row.undo.kind)) return { ok: false, reason: "not_undoable", message: "This change cannot be undone" };
  const now = Date.now();
  if (new Date(row.undo.until).getTime() < now) return { ok: false, reason: "expired", message: "The time to undo this change has passed" };
  if (await isUndone(row._id)) return { ok: false, reason: "already_undone", message: "This change was already undone" };
  const source = sourceOf(row);
  try {
    const handler = await loadUndoHandler(row.undo.kind);
    if (!(await handler.canUndo(ctx, source))) return { ok: false, reason: "not_allowed", message: "You cannot undo this change" };
    const changed = await handler.conflict(source);
    if (changed) {
      return { ok: false, reason: "conflict", changedBy: changed.changedBy, at: changed.at, message: "Changed since. Open the history to restore a version." };
    }
    const ran = await handler.run(ctx, source);
    const window = new Date(row.undo.until).getTime() - (row.createdAt ? new Date(row.createdAt).getTime() : now);
    const until = new Date(now + Math.max(window, 0));
    const written = await audit.append({
      actorId: ctx.actorId,
      actorType: "admin",
      action: `${row.action}.undo`,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      before: redact(row.after),
      after: redact(ran.after),
      summary: ran.summary.slice(0, 200),
      undo: { kind: row.undo.kind, until, ...(ran.undoData === undefined ? {} : { data: ran.undoData }) },
      undoOf: row._id,
      requestId: ctx.requestId,
      ipHash: ctx.ipHash,
    });
    return { ok: true, eventId: String(written._id), undoUntil: until.toISOString() };
  } catch (error) {
    if (error instanceof UndoNotBuiltError) return { ok: false, reason: "not_built", message: error.message };
    throw error;
  }
}
