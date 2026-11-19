import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { isPeopleListing } from "@/server/categories/kinds";
import { PolicyViolationError } from "@/server/http";
import { Category, Listing } from "@/server/models";

/** The sentence a seller (and staff) get when a video is put on a listing about people. */
export const PEOPLE_NO_VIDEO = "Videos are not allowed on people listings.";

/**
 * The locked rule: a listing about people never holds an uploaded video. Same test as the staff upload and the video tours:
 * `isPeopleListing` (a people kind, a people slug, or an adults-only age field).
 */
export async function assertNoVideoOnPeople(listingId: string | mongoose.Types.ObjectId | null | undefined) {
  if (!listingId) return;
  await connectDb();
  const listing = await Listing.findById(listingId).select("categoryId").lean<{ categoryId?: mongoose.Types.ObjectId } | null>();
  if (!listing?.categoryId) return;
  const category = await Category.findById(listing.categoryId).select("slug kind fields").lean<{ slug?: string; kind?: string; fields?: unknown } | null>();
  if (category && isPeopleListing(category)) throw new PolicyViolationError(PEOPLE_NO_VIDEO);
}
