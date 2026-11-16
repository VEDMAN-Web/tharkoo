import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { Category, Listing } from "@/server/models";
import { kindFor } from "@/server/categories/kind";

/**
 * H7.5: the people rule for calls. A listing whose category kind is "people" never shows the Call button (chat stays).
 * Same check as the video tour guard (src/server/wallet/listing-guard.ts): the category's kind, nothing else.
 */
export const PEOPLE_KIND = "people";

type CategoryRow = { slug?: string; kind?: string; fields?: unknown };

export function isPeopleCategory(row: CategoryRow | null | undefined): boolean {
  if (!row) return false;
  return row.kind === PEOPLE_KIND || kindFor(row.slug || "", row.fields) === PEOPLE_KIND;
}

export async function listingIsPeople(listingId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(listingId)) return false;
  await connectDb();
  const listing = await Listing.findById(listingId).select("categoryId").lean<{ categoryId?: unknown } | null>();
  if (!listing?.categoryId) return false;
  const category = await Category.findById(listing.categoryId).select("kind slug fields").lean<CategoryRow | null>();
  return isPeopleCategory(category);
}

/** The category ids, among these, whose kind is "people". Used for the batched badge lookup. */
export async function peopleCategoryIds(categoryIds: string[]): Promise<Set<string>> {
  const valid = categoryIds.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return new Set();
  await connectDb();
  const rows = await Category.find({ _id: { $in: valid } }).select("_id kind slug fields").lean<(CategoryRow & { _id: unknown })[]>();
  return new Set(rows.filter(isPeopleCategory).map((row) => String(row._id)));
}
