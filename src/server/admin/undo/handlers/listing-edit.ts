import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { revalidateListingPages } from "@/server/listings/revalidate";
import { writeVersion } from "@/server/listings/service";
import { setListingValues, valuesOf, type StaffAdValues } from "@/server/listings/staff-edit";
import { Category, Listing } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a staff edit (H8.33). It restores ONLY from the saved undo data: the values the ad had before the edit
 * (words, price, details, category, place and photos). The ad keeps its status (a live ad stays live), and the old values
 * become a new version; nothing is deleted. It refuses when the ad was changed since, so a later edit is never overwritten.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "ads.edit");
  },

  async conflict(event) {
    await connectDb();
    const listing = await Listing.findById(event.targetId).lean<Record<string, unknown> | null>();
    if (!listing) return { changedBy: null, at: new Date().toISOString() };
    const now = valuesOf(JSON.parse(JSON.stringify(listing)) as Record<string, unknown>);
    const expect = event.take<Partial<StaffAdValues>>("expect");
    const same = (Object.keys(expect) as (keyof StaffAdValues)[]).every((key) => JSON.stringify(now[key]) === JSON.stringify(expect[key]));
    return same ? null : { changedBy: null, at: new Date().toISOString() };
  },

  async run(ctx, event) {
    await connectDb();
    const saved = event.take<Partial<StaffAdValues>>("restore");
    const expect = event.take<Partial<StaffAdValues>>("expect");
    if (!Types.ObjectId.isValid(event.targetId)) throw new Error("Ad not found");
    const listing = await Listing.findById(event.targetId);
    if (!listing) throw new Error("Ad not found");
    // An edit saved before photos, place and category were part of it holds fewer fields: the rest stay as they are now.
    const restore: StaffAdValues = { ...valuesOf(JSON.parse(JSON.stringify(listing.toObject())) as Record<string, unknown>), ...saved };
    setListingValues(listing as never, restore);
    await listing.save();
    await writeVersion(listing as never, ctx.actorId);
    if (listing.status === "active") await revalidateListingPages(listing, (await Category.findById(listing.categoryId).select("slug").lean<{ slug?: string }>())?.slug);
    return { after: restore as unknown as Record<string, unknown>, summary: `Undid the edit: ${restore.title}`, undoData: { id: event.targetId, restore: expect, expect: restore } };
  },
};

export default handler;
