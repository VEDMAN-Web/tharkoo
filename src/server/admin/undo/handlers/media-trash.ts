import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { SiteMedia } from "@/server/models";
import type { UndoHandler } from "../registry";

type Fields = { alt: string; phoneVariantId: string | null; focusX: number; focusY: number; trashedAt: string | null; purgeAfter: string | null };

function fieldsOf(row: Record<string, unknown>): Fields {
  return {
    alt: String(row.alt ?? ""),
    phoneVariantId: row.phoneVariantId ? String(row.phoneVariantId) : null,
    focusX: typeof row.focusX === "number" ? row.focusX : 50,
    focusY: typeof row.focusY === "number" ? row.focusY : 50,
    trashedAt: row.trashedAt ? new Date(row.trashedAt as Date).toISOString() : null,
    purgeAfter: row.purgeAfter ? new Date(row.purgeAfter as Date).toISOString() : null,
  };
}

/**
 * Undo of a change to a picture (H8.45): moving it to the Trash, taking it out, or editing its alt text, phone version or
 * focus point. It restores ONLY from the saved undo data and refuses when the picture changed since.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "media.library");
  },

  async conflict(event) {
    await connectDb();
    const row = await SiteMedia.findById(event.targetId).lean<Record<string, unknown> | null>();
    if (!row) return { changedBy: null, at: new Date().toISOString(), message: "The picture is gone, so there is nothing to bring back." };
    return JSON.stringify(fieldsOf(row)) === JSON.stringify(event.take<Fields>("expect")) ? null : { changedBy: null, at: new Date().toISOString() };
  },

  async run(_ctx, event) {
    await connectDb();
    const restore = event.take<Fields>("restore");
    const expect = event.take<Fields>("expect");
    const sets: Record<string, unknown> = { alt: restore.alt, focusX: restore.focusX, focusY: restore.focusY };
    const unsets: Record<string, string> = {};
    if (restore.phoneVariantId) sets.phoneVariantId = new Types.ObjectId(restore.phoneVariantId);
    else unsets.phoneVariantId = "";
    if (restore.trashedAt) sets.trashedAt = new Date(restore.trashedAt);
    else unsets.trashedAt = "";
    if (restore.purgeAfter) sets.purgeAfter = new Date(restore.purgeAfter);
    else unsets.purgeAfter = "";
    await SiteMedia.updateOne({ _id: event.targetId }, { $set: sets, ...(Object.keys(unsets).length ? { $unset: unsets } : {}) });
    return { after: restore as unknown as Record<string, unknown>, summary: `Undid the change to the picture: ${restore.alt}`, undoData: { id: event.targetId, restore: expect, expect: restore } };
  },
};

export default handler;
