import { connectDb } from "@/lib/db";
import { SECRET_KEYS } from "@/server/audit";
import { Site } from "@/server/models";
import type { AdminCtx } from "@/server/admin/context";

export const UNDO_KINDS = [
  "record.restore",
  "listing.decision",
  "listing.edit",
  "user.ban",
  "id.decision",
  "wallet.adjust",
  "demo.end",
  "report.decision",
  "media.trash",
  "layout.publish",
  "content.publish",
] as const;

export type UndoKind = (typeof UNDO_KINDS)[number];

export const UNDO_WINDOW_DEFAULTS = { edits: 30, decisions: 7, credits: 7, demo: 7, settings: 30 } as const;

export type UndoWindowKey = keyof typeof UNDO_WINDOW_DEFAULTS;

export type LockReason = "money_sent" | "message_sent" | "purged" | "legal_record" | "account_deleted";

export function safeUndoData(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter(([key]) => !SECRET_KEYS.has(key)));
}

export class UndoDataMissingError extends Error {
  constructor(key: string) {
    super(`The saved undo data has no "${key}"`);
    this.name = "UndoDataMissingError";
  }
}

export interface UndoSource {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string | null;
  undoOf: string | null;
  createdAt: Date;
  has(key: string): boolean;
  take<T = unknown>(key: string): T;
}

export function undoSourceOf(
  base: { id: string; action: string; targetType: string; targetId: string; actorId: string | null; undoOf: string | null; createdAt: Date },
  data: unknown,
): UndoSource {
  const saved: Record<string, unknown> = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(saved, key);
  return {
    ...base,
    has,
    take<T = unknown>(key: string): T {
      if (!has(key)) throw new UndoDataMissingError(key);
      return saved[key] as T;
    },
  };
}

export interface UndoRun {
  after: Record<string, unknown> | null;
  summary: string;
  undoData?: unknown;
}

export interface UndoHandler {
  canUndo(ctx: AdminCtx, event: UndoSource): boolean | Promise<boolean>;
  conflict(event: UndoSource): Promise<{ changedBy: string | null; at: string } | null>;
  run(ctx: AdminCtx, event: UndoSource): Promise<UndoRun>;
}

export class UndoNotBuiltError extends Error {
  constructor(kind: string) {
    super(`Undo for ${kind} is not built yet`);
    this.name = "UndoNotBuiltError";
  }
}

export function notBuiltHandler(kind: UndoKind): UndoHandler {
  const fail = async (): Promise<never> => {
    throw new UndoNotBuiltError(kind);
  };
  return { canUndo: fail, conflict: fail, run: fail };
}

type Loader = () => Promise<{ default: UndoHandler }>;

const LOADERS: Record<UndoKind, Loader> = {
  "record.restore": () => import("./handlers/record-restore"),
  "listing.decision": () => import("./handlers/listing-decision"),
  "listing.edit": () => import("./handlers/listing-edit"),
  "user.ban": () => import("./handlers/user-ban"),
  "id.decision": () => import("./handlers/id-decision"),
  "wallet.adjust": () => import("./handlers/wallet-adjust"),
  "demo.end": () => import("./handlers/demo-end"),
  "report.decision": () => import("./handlers/report-decision"),
  "media.trash": () => import("./handlers/media-trash"),
  "layout.publish": () => import("./handlers/layout-publish"),
  "content.publish": () => import("./handlers/content-publish"),
};

const overrides = new Map<UndoKind, UndoHandler>();

export function overrideUndoHandler(kind: UndoKind, handler: UndoHandler | null) {
  if (handler) overrides.set(kind, handler);
  else overrides.delete(kind);
}

export function isUndoKind(value: unknown): value is UndoKind {
  return typeof value === "string" && (UNDO_KINDS as readonly string[]).includes(value);
}

export async function loadUndoHandler(kind: UndoKind): Promise<UndoHandler> {
  const override = overrides.get(kind);
  if (override) return override;
  return (await LOADERS[kind]()).default;
}

export async function undoWindowDays(key: UndoWindowKey): Promise<number> {
  await connectDb();
  const site = (await Site.findOne({ key: "default" }).lean()) as { undoWindows?: Partial<Record<UndoWindowKey, number>> } | null;
  const value = site?.undoWindows?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : UNDO_WINDOW_DEFAULTS[key];
}
