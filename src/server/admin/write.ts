import { can, STAFF_ROLES, type Perm } from "@/lib/admin/perms";
import { AuditRepository, redact } from "@/server/audit";
import type { AdminCtx } from "@/server/admin/context";
import { safeUndoData, undoWindowDays, type LockReason, type UndoKind, type UndoWindowKey } from "@/server/admin/undo/registry";
import { ForbiddenError, ValidationError } from "@/server/http";
import { textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();
const REASON_MAX = 500;
const SUMMARY_MAX = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEAF_DEPTH = 6;

export interface AdminWriteSpec<T> {
  perm: Perm;
  action: string;
  target: { type: string; id: string; label?: string };
  reason?: string;
  reasonRequired?: boolean;
  texts?: unknown;
  undo?: { kind: UndoKind; windowKey: UndoWindowKey } | { lock: LockReason };
  before: () => Promise<Record<string, unknown> | null>;
  apply: () => Promise<{ after: Record<string, unknown> | null; result: T; undoData?: unknown; summary: string }>;
  batchId?: string;
}

function roleOf(ctx: AdminCtx): string | undefined {
  return STAFF_ROLES.find((role) => ctx.roles.includes(role)) ?? ctx.roles[0];
}

function stringLeaves(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > LEAF_DEPTH || value === null || value === undefined) return out;
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringLeaves(item, depth + 1, out);
  else if (typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) stringLeaves(item, depth + 1, out);
  return out;
}

async function auditDenial(ctx: AdminCtx, spec: { perm: Perm; action: string; target: { type: string; id: string } }) {
  try {
    await audit.append({
      actorId: ctx.actorId,
      actorType: "admin",
      actorRole: roleOf(ctx),
      action: "admin.write.denied",
      targetType: spec.target.type,
      targetId: spec.target.id,
      after: { attempted: spec.action, perm: spec.perm, roles: [...ctx.roles] },
      requestId: ctx.requestId,
      ipHash: ctx.ipHash,
    });
  } catch (error) {
    console.error("admin.audit.missing", { action: "admin.write.denied", error: error instanceof Error ? error.message : error });
  }
}

export async function adminWrite<T>(ctx: AdminCtx, spec: AdminWriteSpec<T>): Promise<{ result: T; eventId: string; undoUntil: string | null }> {
  if (!can(ctx.roles, spec.perm)) {
    await auditDenial(ctx, spec);
    throw new ForbiddenError("You do not have permission to do this");
  }
  const reason = spec.reason?.trim() ?? "";
  if ((spec.reasonRequired && reason.length < 1) || reason.length > REASON_MAX) {
    throw new ValidationError(`Give a reason of 1 to ${REASON_MAX} characters`);
  }
  for (const leaf of stringLeaves(spec.texts)) {
    if (textDenied(leaf).denied) throw new ValidationError("This text is not allowed on Tharkoo");
  }
  const before = await spec.before();
  const applied = await spec.apply();
  const now = Date.now();
  const undoSpec = spec.undo;
  let undo: { kind: string; until: Date; data?: unknown } | undefined;
  let lock: LockReason | undefined;
  if (undoSpec && "lock" in undoSpec) lock = undoSpec.lock;
  else if (undoSpec) {
    const days = await undoWindowDays(undoSpec.windowKey);
    undo = { kind: undoSpec.kind, until: new Date(now + days * DAY_MS), ...(applied.undoData === undefined ? {} : { data: safeUndoData(applied.undoData) }) };
  }
  try {
    const row = await audit.append({
      actorId: ctx.actorId,
      actorType: "admin",
      actorRole: roleOf(ctx),
      action: spec.action,
      targetType: spec.target.type,
      targetId: spec.target.id,
      targetLabel: spec.target.label,
      before: redact(before),
      after: redact(applied.after),
      reason: reason || undefined,
      summary: applied.summary.slice(0, SUMMARY_MAX),
      undo,
      lock,
      batchId: spec.batchId,
      requestId: ctx.requestId,
      ipHash: ctx.ipHash,
    });
    return { result: applied.result, eventId: String(row._id), undoUntil: undo ? undo.until.toISOString() : null };
  } catch (error) {
    console.error("admin.audit.missing", { action: spec.action, targetId: spec.target.id, error: error instanceof Error ? error.message : error });
    return { result: applied.result, eventId: "", undoUntil: null };
  }
}
