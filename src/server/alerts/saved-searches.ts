import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { SavedSearch } from "@/server/models";
import { NotFoundError } from "@/server/http";

/** H7.6: the saved searches of one signed-in user, for the Alerts page. Read-only except removal. */

export type SavedSearchRow = {
  id: string;
  q: string;
  categorySlug: string;
  citySlug: string;
  createdAt: string | null;
};

export async function listSavedSearches(userId: string, limit = 50): Promise<SavedSearchRow[]> {
  await connectDb();
  const rows = await SavedSearch.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<{ _id: Types.ObjectId; q?: string; categorySlug?: string; citySlug?: string; createdAt?: Date }[]>();
  return rows.map((row) => ({
    id: String(row._id),
    q: row.q ?? "",
    categorySlug: row.categorySlug ?? "",
    citySlug: row.citySlug ?? "",
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }));
}

/** Removes one saved search of this user. Another user's id, or a bad id, is "not found". */
export async function removeSavedSearch(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Saved search not found");
  await connectDb();
  const result = await SavedSearch.deleteOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) });
  if (result.deletedCount === 0) throw new NotFoundError("Saved search not found");
  return { removed: true as const };
}
