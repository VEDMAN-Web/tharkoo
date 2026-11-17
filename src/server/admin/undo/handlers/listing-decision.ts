import { can } from "@/lib/admin/perms";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { takeBackPostingFee } from "@/server/moderation/decide";
import { Category, Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a reject or remove (H8.18). It restores ONLY from the saved undo data: the status the ad had and the status the decision gave it.
 * The status is set directly, never through publishing, so the posting fee is never charged a second time.
 * When the decision gave credits back, they are taken back only if the seller still has them; otherwise the ad is restored and the summary says so.
 * Undoing the undo (redo) is offered only when no money moved.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.decide");
  },

  async conflict(event) {
    const listing = await Listing.findById(event.targetId).select("status").lean<{ status: string } | null>();
    if (listing && listing.status === event.take<string>("from")) return null;
    return { changedBy: null, at: new Date().toISOString() };
  },

  async run(ctx, event) {
    const to = event.take<string>("to");
    const from = event.take<string>("from");
    const refund = event.take<{ userId: string; amount: number } | null>("refund");
    const listing = await Listing.findById(event.targetId);
    if (!listing) throw new Error("Ad not found");
    listing.status = to as typeof listing.status;
    await listing.save();
    await revalidateListingPages(listing, (await Category.findById(listing.categoryId).select("slug").lean<{ slug?: string }>())?.slug);
    let note = "";
    let moved = false;
    if (refund && refund.amount > 0) {
      moved = await takeBackPostingFee({ userId: refund.userId, listingId: event.targetId, amount: refund.amount, requestId: ctx.requestId });
      note = moved ? `, took back ${refund.amount} credits` : ", credits already spent, not taken back";
    }
    return {
      after: { status: to, creditsTakenBack: moved ? refund?.amount ?? 0 : 0 },
      summary: `Undid the decision: ad is ${to === "active" ? "live" : to}${note}`,
      undoData: refund && moved ? undefined : { id: event.targetId, from: to, to: from, refund: null },
    };
  },
};

export default handler;
