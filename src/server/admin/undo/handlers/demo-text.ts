import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { demoFilter } from "@/server/listings/demo-ads";
import { Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of "Refresh sample ad text" (H17.10). The undo data has, for each ad, its old title and text and the title the refresh gave it.
 * An ad whose title is no longer the one the refresh gave (someone edited it since) is left alone.
 */
type Item = [id: string, title: string, description: string, newTitle: string];

const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.demo.end");
  },

  async conflict(event) {
    await connectDb();
    const items = event.take<Item[]>("items");
    const filter = await demoFilter();
    if (!filter) return { changedBy: null, at: new Date().toISOString(), message: "There are no sample ads any more." };
    const same = await Listing.countDocuments({ ...filter, $or: items.slice(0, 500).map(([id, , , title]) => ({ _id: new Types.ObjectId(id), title })) });
    return same > 0 ? null : { changedBy: null, at: new Date().toISOString(), message: "The sample ads were changed since, so the old text cannot be put back." };
  },

  async run(_ctx, event) {
    await connectDb();
    const items = event.take<Item[]>("items");
    const filter = await demoFilter();
    if (!filter) return { after: { restored: 0 }, summary: "No sample ads to put back" };
    let restored = 0;
    const chunk = 400;
    for (let from = 0; from < items.length; from += chunk) {
      const result = await Listing.bulkWrite(
        items.slice(from, from + chunk).map(([id, title, description, newTitle]) => ({
          updateOne: { filter: { _id: new Types.ObjectId(id), ...filter, title: newTitle }, update: { $set: { title, description } } },
        })),
      );
      restored += result.modifiedCount;
    }
    await refreshPublicCache();
    return { after: { restored }, summary: `Undid the text refresh: ${restored} sample ${restored === 1 ? "ad has" : "ads have"} its old text back` };
  },
};

export default handler;
