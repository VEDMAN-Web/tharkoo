import { credits, mayUndoStaffChange, reverseCredits } from "@/server/billing/staff-credits";
import { walletBalance } from "@/server/billing/ledger";
import { ConflictError } from "@/server/http";
import type { UndoHandler } from "../registry";

/**
 * Undo of a staff credit change (H8.14). It uses ONLY the saved undo data: `delta`, the signed credits the event applied.
 * Undo writes the opposite ledger line. Credits that were added and already spent cannot be taken back (a conflict that says why);
 * the Credits tab then offers to remove what is left. Undoing the undo (redo) applies the original change again.
 */
const handler: UndoHandler = {
  canUndo(ctx, event) {
    return mayUndoStaffChange(ctx.roles, ctx.actorId, event.actorId);
  },

  async conflict(event) {
    const back = -event.take<number>("delta");
    if (back >= 0) return null;
    const balance = await walletBalance(event.targetId);
    if (balance >= -back) return null;
    return {
      changedBy: null,
      at: new Date().toISOString(),
      message: balance > 0 ? `Only ${credits(balance)} of these ${credits(-back)} are left, so this cannot be undone. Remove what is left instead.` : `These ${credits(-back)} are already spent, so this cannot be undone.`,
    };
  },

  async run(ctx, event) {
    const delta = event.take<number>("delta");
    try {
      const done = await reverseCredits({ userId: event.targetId, delta, eventId: event.id, ctx });
      const word = done.delta > 0 ? "Gave back" : "Took back";
      return {
        after: { delta: done.delta, balanceAfter: done.balance },
        summary: `${event.undoOf ? "Applied again" : "Undid the credit change"}: ${word.toLowerCase()} ${credits(Math.abs(done.delta))}`,
        undoData: { delta: done.delta },
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient credits") throw new ConflictError("These credits are already spent, so this cannot be undone.");
      throw error;
    }
  },
};

export default handler;
