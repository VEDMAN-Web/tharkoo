import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { ALT_MIN, inUseMessage, present, removeStoredFile, validateAlt, type MediaItem } from "@/server/layout/media";
import { findMediaUsages, mediaUsageCounts, type MediaUsage } from "@/server/layout/media-refs";
import { Banner, SiteMedia } from "@/server/models";
import type { SiteMediaDoc } from "@/server/models/layout";

const audit = new AuditRepository();
const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_DAYS = 30;
const ALL_LIMIT = 5000;

type Row = SiteMediaDoc & { _id: Types.ObjectId };
type Doc = Record<string, unknown>;

export type MediaTabCounts = { pictures: number; unused: number; missing: number; trash: number; notices: number };
export type MediaDetail = { item: MediaItem; phone: MediaItem | null; usages: MediaUsage[]; trashed: boolean };

function requireMedia(roles: readonly string[]) {
  if (!can(roles, "settings.edit")) throw new ForbiddenError("Only an admin can open the media library");
}

async function requireWrite(ctx: AdminCtx, id: string, action: string) {
  if (can(ctx.roles, "settings.edit")) return;
  await adminWrite(ctx, { perm: "settings.edit", action, target: { type: "site_media", id }, before: async () => null, apply: async () => ({ after: null, result: null, summary: "" }) });
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function load(id: string): Promise<Row> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Picture not found");
  const row = await SiteMedia.findById(id).lean<Row | null>();
  if (!row) throw new NotFoundError("Picture not found");
  return row;
}

/** The numbers on the tabs. The Notices tab counts the notices of the Broadcasts screen. */
export async function mediaTabCounts(roles: readonly string[]): Promise<MediaTabCounts> {
  requireMedia(roles);
  await connectDb();
  const live = { trashedAt: null };
  const [pictures, trash, missing, notices, ids] = await Promise.all([
    SiteMedia.countDocuments(live),
    SiteMedia.countDocuments({ trashedAt: { $ne: null } }),
    SiteMedia.countDocuments({ ...live, $or: [{ alt: "" }, { alt: { $regex: `^.{0,${ALT_MIN - 1}}$` } }, { altAuto: true }] }),
    Banner.countDocuments({}),
    SiteMedia.find(live).select("_id").limit(ALL_LIMIT).lean<{ _id: Types.ObjectId }[]>(),
  ]);
  const used = await mediaUsageCounts(ids.map((row) => String(row._id)));
  return { pictures, unused: Math.max(0, ids.length - used.size), missing, trash, notices };
}

/** One picture with where it is used. The phone version is returned as a picture too. */
export async function getMediaDetail(roles: readonly string[], id: string): Promise<MediaDetail> {
  requireMedia(roles);
  await connectDb();
  const row = await load(id);
  const [usages, phone] = await Promise.all([findMediaUsages(id), row.phoneVariantId ? SiteMedia.findById(row.phoneVariantId).lean<Row | null>() : null]);
  return { item: present(row), phone: phone ? present(phone) : null, usages, trashed: Boolean(row.trashedAt) };
}

export type MediaDetailsInput = { alt: unknown; phoneMediaId: string | null; focusX: unknown; focusY: unknown };

function focus(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new ValidationError("Invalid request", { [label]: ["Use a number from 0 to 100."] });
  return Math.round(number);
}

type Fields = { alt: string; phoneVariantId: string | null; focusX: number; focusY: number; trashedAt: string | null; purgeAfter: string | null };

function fieldsOf(row: Doc): Fields {
  return {
    alt: String(row.alt ?? ""),
    phoneVariantId: row.phoneVariantId ? String(row.phoneVariantId) : null,
    focusX: typeof row.focusX === "number" ? row.focusX : 50,
    focusY: typeof row.focusY === "number" ? row.focusY : 50,
    trashedAt: row.trashedAt ? new Date(row.trashedAt as Date).toISOString() : null,
    purgeAfter: row.purgeAfter ? new Date(row.purgeAfter as Date).toISOString() : null,
  };
}

async function writeFields(id: string, next: Fields) {
  const sets: Doc = { alt: next.alt, focusX: next.focusX, focusY: next.focusY, altAuto: false };
  const unsets: Doc = {};
  if (next.phoneVariantId) sets.phoneVariantId = new Types.ObjectId(next.phoneVariantId);
  else unsets.phoneVariantId = "";
  if (next.trashedAt) sets.trashedAt = new Date(next.trashedAt);
  else unsets.trashedAt = "";
  if (next.purgeAfter) sets.purgeAfter = new Date(next.purgeAfter);
  else unsets.purgeAfter = "";
  await SiteMedia.updateOne({ _id: id }, { ...(Object.keys(sets).length ? { $set: sets } : {}), ...(Object.keys(unsets).length ? { $unset: unsets } : {}) });
}

/** Saves the alt text, the phone version and the focus point of one picture. One audited write; Undo puts the old values back. */
export async function saveMediaDetails(ctx: AdminCtx, id: string, input: MediaDetailsInput): Promise<{ eventId: string; changed: boolean; item: MediaItem }> {
  await connectDb();
  await requireWrite(ctx, id, "media.update");
  const row = await load(id);
  if (row.trashedAt) throw new ConflictError("This picture is in the Trash. Restore it to change it.");
  const alt = validateAlt(input.alt);
  let phone: string | null = null;
  if (input.phoneMediaId) {
    if (!Types.ObjectId.isValid(input.phoneMediaId) || input.phoneMediaId === id) throw new ValidationError("Invalid request", { phone: ["Choose another picture from the library."] });
    const other = await SiteMedia.findById(input.phoneMediaId).select("trashedAt").lean<{ trashedAt?: Date | null } | null>();
    if (!other || other.trashedAt) throw new ValidationError("Invalid request", { phone: ["That picture is not in the library any more."] });
    phone = input.phoneMediaId;
  }
  const before = fieldsOf(plain(row) as unknown as Doc);
  const next: Fields = { ...before, alt, phoneVariantId: phone, focusX: focus(input.focusX, "focusX"), focusY: focus(input.focusY, "focusY") };
  if (JSON.stringify(before) === JSON.stringify(next) && row.altAuto !== true) return { eventId: "", changed: false, item: present(row) };
  const written = await adminWrite<null>(ctx, {
    perm: "settings.edit",
    action: "media.update",
    target: { type: "site_media", id, label: alt },
    texts: [alt],
    undo: { kind: "media.trash", windowKey: "edits" },
    before: async () => before as unknown as Doc,
    apply: async () => {
      await writeFields(id, next);
      return { after: next as unknown as Doc, result: null, summary: `Changed the picture: ${alt}`, undoData: { id, restore: before, expect: next } };
    },
  });
  return { eventId: written.eventId, changed: true, item: present(await load(id)) };
}

/** Moves a picture to the Trash for 30 days. Refused while a page, category or place uses it. */
export async function trashMedia(ctx: AdminCtx, id: string): Promise<{ eventId: string; purgeAfter: string }> {
  await connectDb();
  await requireWrite(ctx, id, "media.trash");
  const row = await load(id);
  if (row.trashedAt) throw new ConflictError("This picture is already in the Trash.");
  const usages = await findMediaUsages(id);
  if (usages.length) throw new ConflictError(inUseMessage(usages));
  const before = fieldsOf(plain(row) as unknown as Doc);
  const purgeAfter = new Date(Date.now() + TRASH_DAYS * DAY_MS).toISOString();
  const next: Fields = { ...before, trashedAt: new Date().toISOString(), purgeAfter };
  const written = await adminWrite<null>(ctx, {
    perm: "settings.edit",
    action: "media.trash",
    target: { type: "site_media", id, label: row.alt },
    undo: { kind: "media.trash", windowKey: "edits" },
    before: async () => before as unknown as Doc,
    apply: async () => {
      await writeFields(id, next);
      return { after: next as unknown as Doc, result: null, summary: `Moved to the Trash: ${row.alt}`, undoData: { id, restore: before, expect: next } };
    },
  });
  return { eventId: written.eventId, purgeAfter };
}

/** Takes a picture out of the Trash. */
export async function restoreMedia(ctx: AdminCtx, id: string): Promise<{ eventId: string }> {
  await connectDb();
  await requireWrite(ctx, id, "media.restore");
  const row = await load(id);
  if (!row.trashedAt) throw new ConflictError("This picture is not in the Trash.");
  const before = fieldsOf(plain(row) as unknown as Doc);
  const next: Fields = { ...before, trashedAt: null, purgeAfter: null };
  const written = await adminWrite<null>(ctx, {
    perm: "settings.edit",
    action: "media.restore",
    target: { type: "site_media", id, label: row.alt },
    undo: { kind: "media.trash", windowKey: "edits" },
    before: async () => before as unknown as Doc,
    apply: async () => {
      await writeFields(id, next);
      return { after: next as unknown as Doc, result: null, summary: `Took out of the Trash: ${row.alt}`, undoData: { id, restore: before, expect: next } };
    },
  });
  return { eventId: written.eventId };
}

/**
 * The daily purge (H8.45): pictures that stayed in the Trash past their date are removed for good, file and row.
 * A picture that a page started using again is kept and its Trash mark is cleared. Each purge is one locked audit row.
 */
export async function purgeTrashedMedia(now = new Date()): Promise<{ purged: number; kept: number }> {
  await connectDb();
  const due = await SiteMedia.find({ trashedAt: { $ne: null }, purgeAfter: { $lte: now } }).limit(200).lean<Row[]>();
  let purged = 0;
  let kept = 0;
  for (const row of due) {
    const id = String(row._id);
    if ((await findMediaUsages(id)).length) {
      await SiteMedia.updateOne({ _id: id }, { $unset: { trashedAt: "", purgeAfter: "" } });
      kept += 1;
      continue;
    }
    await SiteMedia.deleteOne({ _id: id });
    await removeStoredFile(row.objectKey);
    await audit.append({
      actorId: null,
      actorType: "system",
      action: "media.purge",
      targetType: "site_media",
      targetId: id,
      targetLabel: row.alt,
      before: { url: row.url, alt: row.alt },
      lock: "purged",
      summary: `Removed from the Trash for good: ${row.alt}`,
      requestId: crypto.randomUUID(),
    });
    purged += 1;
  }
  return { purged, kept };
}
