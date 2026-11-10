import type { Types } from "mongoose";
import { AuditEvent } from "@/server/models/trust";

export interface AuditInput {
  actorId?: Types.ObjectId | string | null;
  actorType: "user" | "admin" | "worker" | "system";
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  requestId: string;
  ipHash?: string;
}

export interface AuditQuery {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}

/** Insert and read only. Updates and deletes are not part of this API. */
export class AuditRepository {
  async append(event: AuditInput) {
    return AuditEvent.create({
      actorId: event.actorId ?? null,
      actorType: event.actorType,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      before: event.before,
      after: event.after,
      reason: event.reason,
      requestId: event.requestId,
      ipHash: event.ipHash,
    });
  }

  async list(filter: AuditQuery = {}) {
    const query: Record<string, unknown> = {};
    if (filter.actorId) query.actorId = filter.actorId;
    if (filter.action) query.action = filter.action;
    if (filter.targetType) query.targetType = filter.targetType;
    if (filter.targetId) query.targetId = filter.targetId;
    return AuditEvent.find(query).sort({ createdAt: -1 }).limit(200).lean();
  }
}

export function redact(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const secretKeys = new Set([
    "passwordHash",
    "tokenHash",
    "contact",
    "documentRef",
    "password",
    "token",
    "hashes",
  ]);
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = secretKeys.has(key) ? "[redacted]" : nested;
  }
  return output;
}
