import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { writeVersion } from "@/server/listings/service";
import { Category, Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

type Values = { title: string; description: string; price: number | ""; attributes: Record<string, unknown> };

/**
 * Undo of a staff edit (H8.33). It restores ONLY from the saved undo data: the values the ad had before the edit.
 * The ad keeps its status (a live ad stays live), and the old values become a new version; nothing is deleted.
 * It refuses when the ad was changed since, so a later edit is never overwritten.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.edit");
  },

  async conflict(event) {
    await connectDb();
    const listing = await Listing.findById(event.targetId).select("title description price attributes").lean<Record<string, unknown> | null>();
    if (!listing) return { changedBy: null, at: new Date().toISOString() };
    const now = { title: listing.title, description: listing.description, price: typeof listing.price === "number" ? listing.price : "", attributes: listing.attributes ?? {} };
    return JSON.stringify(now) === JSON.stringify(event.take<Values>("expect")) ? null : { changedBy: null, at: new Date().toISOString() };
  },

  async run(ctx, event) {
    await connectDb();
    const restore = event.take<Values>("restore");
    const expect = event.take<Values>("expect");
    if (!Types.ObjectId.isValid(event.targetId)) throw new Error("Ad not found");
    const listing = await Listing.findById(event.targetId);
    if (!listing) throw new Error("Ad not found");
    listing.title = restore.title;
    listing.description = restore.description;
    if (restore.price === "") listing.set("price", undefined);
    else listing.price = restore.price;
    listing.attributes = restore.attributes;
    listing.markModified("attributes");
    await listing.save();
    await writeVersion(listing as never, ctx.actorId);
    if (listing.status === "active") await revalidateListingPages(listing, (await Category.findById(listing.categoryId).select("slug").lean<{ slug?: string }>())?.slug);
    return { after: restore as unknown as Record<string, unknown>, summary: `Undid the edit: ${restore.title}`, undoData: { id: event.targetId, restore: expect, expect: restore } };
  },
};

export default handler;
