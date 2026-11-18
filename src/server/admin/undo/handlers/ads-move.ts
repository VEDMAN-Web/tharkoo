import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of "Move to category" (H10.2). The undo data holds, for each ad, the category (and sub-category) it had before and the
 * category it was moved to. It puts back only ads that are STILL in that new category, so an ad that was moved again later is left alone.
 */
type Item = [id: string, category: string, subcategory: string];

const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.edit");
  },

  async conflict(event) {
    await connectDb();
    const to = event.take<string>("to");
    const items = event.take<Item[]>("items");
    const ids = items.map((item) => new Types.ObjectId(item[0]));
    const moved = await Listing.countDocuments({ _id: { $in: ids }, categoryId: new Types.ObjectId(to) });
    if (moved === items.length) return null;
    const away = items.length - moved;
    return { changedBy: null, at: new Date().toISOString(), message: `${away} of the ${items.length} ads were changed since, so the move cannot be undone as a whole.` };
  },

  async run(_ctx, event) {
    await connectDb();
    const to = new Types.ObjectId(event.take<string>("to"));
    const items = event.take<Item[]>("items");
    const result = await Listing.bulkWrite(
      items.map(([id, category, subcategory]) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id), categoryId: to },
          update: subcategory ? { $set: { categoryId: new Types.ObjectId(category), subcategoryId: new Types.ObjectId(subcategory) } } : { $set: { categoryId: new Types.ObjectId(category) }, $unset: { subcategoryId: "" } },
        },
      })),
    );
    await refreshPublicCache();
    const restored = result.modifiedCount;
    return { after: { restored }, summary: `Put ${restored} ${restored === 1 ? "ad" : "ads"} back in their old category` };
  },
};

export default handler;
