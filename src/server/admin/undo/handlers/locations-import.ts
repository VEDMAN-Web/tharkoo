import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { Listing, Location } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of "Import cities and areas" (H16.1). The undo data holds the ids of the places that import added. They are removed again
 * when none of them has ads or places inside it yet. If one has, the import cannot be undone as a whole: hide that place instead.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "catalogue.edit");
  },

  async conflict(event) {
    await connectDb();
    const ids = event.take<string[]>("ids").map((id) => new Types.ObjectId(id));
    const present = await Location.countDocuments({ _id: { $in: ids } });
    if (present === 0) return { changedBy: null, at: new Date().toISOString(), message: "The places of this import are already gone." };
    const withChildren = await Location.countDocuments({ parentId: { $in: ids } });
    const withAds = await Listing.countDocuments({ $or: [{ cityId: { $in: ids } }, { districtId: { $in: ids } }] });
    if (withChildren === 0 && withAds === 0) return null;
    return { changedBy: null, at: new Date().toISOString(), message: "Some of these places now have ads or places inside them, so the import cannot be undone as a whole. Hide those places instead." };
  },

  async run(_ctx, event) {
    await connectDb();
    const ids = event.take<string[]>("ids").map((id) => new Types.ObjectId(id));
    const removed = await Location.deleteMany({ _id: { $in: ids } });
    await refreshPublicCache();
    const count = removed.deletedCount ?? 0;
    return { after: { removed: count }, summary: `Undid the import: ${count.toLocaleString("en-IN")} ${count === 1 ? "place was" : "places were"} removed` };
  },
};

export default handler;
