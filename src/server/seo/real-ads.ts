import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models";
import { demoOwnerId, DEMO_SLUG } from "@/server/listings/demo-ads";

/**
 * H18.2 (Vedant, 21 Nov 2026: "let it only crawl on actual posted ads"): a listing page is shown to Google only when it
 * has at least one REAL live ad. Sample (demo) ads never count. This is the filter that leaves sample ads out.
 */
export async function notSampleClause(): Promise<Record<string, unknown>[]> {
  await connectDb();
  const seedOwner = await demoOwnerId();
  // An ObjectId, not a string: aggregate pipelines do not cast, so a string id would match nothing.
  return seedOwner ? [{ $nor: [{ ownerId: new Types.ObjectId(seedOwner), slug: { $regex: DEMO_SLUG.source } }] }] : [];
}

/** True when the city (by id) has at least one real live ad, in any category. One indexed query. */
export async function cityHasRealAds(cityId: unknown): Promise<boolean> {
  if (!cityId) return false;
  await connectDb();
  const found = await Listing.exists({
    $and: [
      { cityId, status: "active", feedHidden: { $ne: true } },
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ...(await notSampleClause()),
    ],
  });
  return Boolean(found);
}
