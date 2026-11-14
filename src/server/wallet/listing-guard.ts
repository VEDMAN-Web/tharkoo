import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { ForbiddenError } from "@/server/http";
import { Category, Listing } from "@/server/models";
import { CATEGORY_KINDS } from "@/server/models/catalog";
import { Subcategory } from "@/server/models/subcategory";

const OFF = "Live video tours are off for this ad";

interface ListingRow {
  categoryId?: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId;
}

interface CategoryRow {
  kind?: string;
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
  const category = (await Category.findById(listing.categoryId).select("kind videoTourEnabled videoTourCoins").lean()) as CategoryRow | null;
  if (!category || !(CATEGORY_KINDS as readonly string[]).includes(category.kind ?? "")) throw new ForbiddenError(OFF);
  if (category.kind === "people") throw new ForbiddenError("Not available for people listings");
  const sub = listing.subcategoryId
    ? ((await Subcategory.findById(listing.subcategoryId).select("videoTourEnabled").lean()) as { videoTourEnabled?: boolean | null } | null)
    : null;
  const enabled = typeof sub?.videoTourEnabled === "boolean" ? sub.videoTourEnabled : category.videoTourEnabled === true;
  if (!enabled) throw new ForbiddenError(OFF);
}

/** The coin price of a live tour on this listing, read from its category. Defaults to 1 coin. */
export async function videoTourPrice(listingId: string): Promise<number> {
  await connectDb();
  const listing = (await Listing.findById(listingId).select("categoryId").lean()) as ListingRow | null;
  if (!listing?.categoryId) throw new ForbiddenError(OFF);
  const category = (await Category.findById(listing.categoryId).select("videoTourCoins").lean()) as CategoryRow | null;
  return category?.videoTourCoins ?? 1;
}
