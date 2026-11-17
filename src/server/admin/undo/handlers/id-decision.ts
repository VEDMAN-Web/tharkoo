import { can } from "@/lib/admin/perms";
import { IdentityVerification, User } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of an ID check decision (Reopen, H8.23). It restores ONLY from the saved undo data: the check's earlier status and the user's earlier
 * verification status, so the verified badge is off until it is decided again. The photos and documents are never touched.
 * Undoing the undo applies the decision again, with the reason and date the undo saved.
 */
type Saved = { reason: string | null; decidedAt: string | null };

const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "id.decide");
  },

  async conflict(event) {
    const row = await IdentityVerification.findById(event.take<string>("id")).select("status").lean<{ status: string } | null>();
    return row && row.status === event.take<string>("from") ? null : { changedBy: null, at: new Date().toISOString() };
  },

  async run(_ctx, event) {
    const id = event.take<string>("id");
    const userId = event.take<string>("userId");
    const to = event.take<string>("to");
    const from = event.take<string>("from");
    const saved = event.has("saved") ? event.take<Saved>("saved") : null;
    const row = await IdentityVerification.findById(id).select("decisionReason decidedAt").lean<{ decisionReason?: string; decidedAt?: Date } | null>();
    const keep: Saved = { reason: row?.decisionReason ?? null, decidedAt: row?.decidedAt ? new Date(row.decidedAt).toISOString() : null };
    if (to === "pending_review") {
      await IdentityVerification.updateOne({ _id: id }, { $set: { status: to }, $unset: { decisionReason: "", decidedAt: "" } });
    } else {
      await IdentityVerification.updateOne(
        { _id: id },
        { $set: { status: to, ...(saved?.reason ? { decisionReason: saved.reason } : {}), ...(saved?.decidedAt ? { decidedAt: new Date(saved.decidedAt) } : { decidedAt: new Date() }) } },
      );
    }
    await User.updateOne({ _id: userId }, { $set: { verificationStatus: event.take<string>("userTo") } });
    return {
      after: { status: to },
      summary: to === "pending_review" ? "Reopened an ID check: waiting again, badge off" : `Put the ID check back to ${to}`,
      undoData: { id, userId, from: to, to: from, userFrom: event.take<string>("userTo"), userTo: event.take<string>("userFrom"), saved: keep },
    };
  },
};

export default handler;
