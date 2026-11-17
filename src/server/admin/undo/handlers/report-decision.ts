import { can } from "@/lib/admin/perms";
import { refreshAdPages } from "@/server/admin/user-actions";
import { Listing, Report } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a decision on reports (H8.21). It restores ONLY from the saved undo data: each report's earlier status and dates, and the ad's
 * earlier status when the decision paused it. Taking an ad down is a separate decision with its own undo (listing.decision).
 * Undoing the undo (redo) applies the decision again from the data the undo saved. No money moves here, so redo is always offered.
 */
type Stamp = { status: string; ackAt: string | null; resolvedAt: string | null };
type Entry = { id: string; was: Stamp; now: Stamp };
type Move = { id: string; was: string; now: string } | null;

const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "reports.handle");
  },

  async conflict(event) {
    const entries = event.take<Entry[]>("reports");
    const listing = event.take<Move>("listing");
    const rows = await Report.find({ _id: { $in: entries.map((entry) => entry.id) } }).select("status").lean<{ _id: unknown; status: string }[]>();
    const status = new Map(rows.map((row) => [String(row._id), row.status]));
    const reportsMoved = entries.some((entry) => status.get(entry.id) !== entry.now.status);
    const adMoved = listing ? (await Listing.findById(listing.id).select("status").lean<{ status: string } | null>())?.status !== listing.now : false;
    return reportsMoved || adMoved ? { changedBy: null, at: new Date().toISOString() } : null;
  },

  async run(_ctx, event) {
    const entries = event.take<Entry[]>("reports");
    const listing = event.take<Move>("listing");
    for (const entry of entries) {
      const set: Record<string, unknown> = { status: entry.was.status };
      const unset: Record<string, ""> = {};
      if (entry.was.ackAt) set.ackAt = new Date(entry.was.ackAt);
      else unset.ackAt = "";
      if (entry.was.resolvedAt) set.resolvedAt = new Date(entry.was.resolvedAt);
      else unset.resolvedAt = "";
      await Report.updateOne({ _id: entry.id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    }
    if (listing) {
      await Listing.updateOne({ _id: listing.id }, { $set: { status: listing.was } });
      await refreshAdPages([listing.id]);
    }
    return {
      after: { status: entries[0]?.was.status ?? "open", reports: entries.length },
      summary: `Undid the decision: ${entries.length} ${entries.length === 1 ? "report" : "reports"} ${entries[0]?.was.status === "open" ? "open again" : entries[0]?.was.status ?? "restored"}`,
      undoData: { reports: entries.map((entry) => ({ id: entry.id, was: entry.now, now: entry.was })), listing: listing ? { id: listing.id, was: listing.now, now: listing.was } : null },
    };
  },
};

export default handler;
