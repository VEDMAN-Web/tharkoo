import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { ForbiddenError } from "@/server/http";
import { Category, Listing, PromotionOrder } from "@/server/models";
import { isPeopleListing, kindAllowsVideo } from "@/server/categories/kinds";
import { Subcategory } from "@/server/models/subcategory";

const OFF = "Live video tours are off for this ad";

interface ListingRow {
  categoryId?: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId;
}

interface CategoryRow {
  slug?: string;
  kind?: string;
  fields?: unknown;
  videoTourEnabled?: boolean;
  videoTourCoins?: number;
}

/**
 * The people-category rule and the video-tour switch, read from the database on every escrow hold.
 * A process-local registry is not enough: a fresh serverless instance may never load the code that registers it.
 * Fails closed: a missing listing, a missing or unknown category kind, a people category or an off switch all refuse.
 */
export async function assertVideoTourAllowed(listingId: string): Promise<void> {
  await connectDb();
  if (!mongoose.isValidObjectId(listingId)) throw new ForbiddenError(OFF);
  const listing = (await Listing.findById(listingId).select("categoryId subcategoryId").lean()) as ListingRow | null;
  if (!listing?.categoryId) throw new ForbiddenError(OFF);
  const category = (await Category.findById(listing.categoryId).select("slug kind fields videoTourEnabled videoTourCoins").lean()) as CategoryRow | null;
  if (!category) throw new ForbiddenError(OFF);
  if (isPeopleListing(category)) throw new ForbiddenError("Not available for people listings");
  if (!(await kindAllowsVideo(category))) throw new ForbiddenError(OFF);
  const sub = listing.subcategoryId
    ? ((await Subcategory.findById(listing.subcategoryId).select("videoTourEnabled").lean()) as { videoTourEnabled?: boolean | null } | null)
    : null;
  const enabled = typeof sub?.videoTourEnabled === "boolean" ? sub.videoTourEnabled : category.videoTourEnabled === true;
  if (!enabled) throw new ForbiddenError(OFF);
  if (!(await listingIsPromoted(listingId))) throw new ForbiddenError(NOT_PROMOTED);
}

/** H18.8 (Vedant, 21 Nov 2026): video calls only on ads that have TOP or Super Top running right now. */
export const NOT_PROMOTED = "Video calls are only on ads with TOP or Super Top";

export async function listingIsPromoted(listingId: string, now: Date = new Date()): Promise<boolean> {
  await connectDb();
  if (!mongoose.isValidObjectId(listingId)) return false;
  const row = await PromotionOrder.exists({ listingId: new mongoose.Types.ObjectId(listingId), status: "active", startsAt: { $not: { $gt: now } }, endsAt: { $gt: now } });
  return Boolean(row);
}

/** The coin price of a live tour on this listing, read from its category. Defaults to 1 coin. */
export async function videoTourPrice(listingId: string): Promise<number> {
  await connectDb();
  const listing = (await Listing.findById(listingId).select("categoryId").lean()) as ListingRow | null;
  if (!listing?.categoryId) throw new ForbiddenError(OFF);
  const category = (await Category.findById(listing.categoryId).select("videoTourCoins").lean()) as CategoryRow | null;
  return category?.videoTourCoins ?? 1;
}
