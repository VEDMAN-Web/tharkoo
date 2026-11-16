import { can } from "@/lib/admin/perms";
import { refreshAdPages, revokeSessions } from "@/server/admin/user-actions";
import { Listing, User } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a ban (H8.11). It restores ONLY from the saved undo data: the ads this ban paused, and only those that are still paused.
 * Ads the seller had paused before stay paused, and ended sign-ins are not brought back.
 * Undoing the undo (redo) bans again from the data the undo saved: it pauses those ads, suspends the user and ends the sessions.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "users.ban");
  },

  async conflict(event) {
    const user = await User.findById(event.targetId).select("status").lean<{ status: string } | null>();
    const expected = event.undoOf ? "active" : "suspended";
    if (user && user.status === expected) return null;
    return { changedBy: null, at: new Date().toISOString() };
  },

  async run(_ctx, event) {
    const ids = event.take<string[]>("pausedListingIds").map(String);
    const owned = (status: "paused" | "active") => ({ _id: { $in: ids }, ownerId: event.targetId, status });
    if (!event.undoOf) {
      const rows = ids.length ? await Listing.find(owned("paused")).select("_id").lean() : [];
      const resumed = rows.map((row) => String(row._id));
      if (resumed.length) await Listing.updateMany({ _id: { $in: resumed } }, { $set: { status: "active" } });
      await User.updateOne({ _id: event.targetId }, { $set: { status: "active" } });
      await refreshAdPages(resumed);
      return {
        after: { status: "active", resumedListings: resumed.length },
        summary: `Undid the ban: ${resumed.length} ${resumed.length === 1 ? "ad" : "ads"} live again`,
        undoData: { pausedListingIds: resumed },
      };
    }
    const rows = ids.length ? await Listing.find(owned("active")).select("_id").lean() : [];
    const paused = rows.map((row) => String(row._id));
    if (paused.length) await Listing.updateMany({ _id: { $in: paused } }, { $set: { status: "paused" } });
    await User.updateOne({ _id: event.targetId }, { $set: { status: "suspended" } });
    const ended = await revokeSessions(event.targetId);
    await refreshAdPages(paused);
    return {
      after: { status: "suspended", pausedListings: paused.length, sessionsEnded: ended },
      summary: `Banned again: ${paused.length} ${paused.length === 1 ? "ad" : "ads"} paused`,
      undoData: { pausedListingIds: paused },
    };
  },
};

export default handler;
