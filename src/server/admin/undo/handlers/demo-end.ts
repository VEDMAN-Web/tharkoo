import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { DEMO_END_STATUS, reviveDemoBatch } from "@/server/listings/demo-ads";
import { Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of "End demo ads" (H8.30): the ads of that batch that are still ended come back live. Ads that expired by themselves
 * carry no batch id and stay as they are. There is no redo, because the batch id is cleared when the ads come back.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.demo.end");
  },

  async conflict(event) {
    await connectDb();
    const waiting = await Listing.countDocuments({ demoEndedBatch: event.take<string>("batch"), status: DEMO_END_STATUS });
    return waiting > 0 ? null : { changedBy: null, at: new Date().toISOString(), message: "The demo ads were already brought back." };
  },

  async run(_ctx, event) {
    const restored = await reviveDemoBatch(event.take<string>("batch"));
    return { after: { restored }, summary: `Undid ending the demo ads: ${restored} ${restored === 1 ? "ad is" : "ads are"} live again` };
  },
};

export default handler;
