import type { Types } from "mongoose";
import { PolicyViolationError } from "@/server/http";
import { MediaAsset } from "@/server/models";
import { AD_MEDIA_LIMIT_MESSAGE, AD_MEDIA_MAX, CLOSED_MEDIA_STATUSES } from "@/server/media/config";
import { connectDb } from "@/lib/db";

/**
 * H6.18: one limit for every ad, photos and videos together (AD_MEDIA_MAX). These counts are the server's check;
 * the browser only shows the same number. A media row that is deleted, failed or refused does not count.
 */
export async function adMediaCount(listingId: Types.ObjectId | string) {
  await connectDb();
  return MediaAsset.countDocuments({
    listingId,
    kind: { $in: ["image", "video"] },
    status: { $nin: CLOSED_MEDIA_STATUSES },
  });
}

export async function adVideoCount(listingId: Types.ObjectId | string) {
  await connectDb();
  return MediaAsset.countDocuments({ listingId, kind: "video", status: { $nin: CLOSED_MEDIA_STATUSES } });
}

/** Throws when adding `adding` more media would go past the ad's limit. */
export async function assertAdMediaRoom(listingId: Types.ObjectId | string, adding = 1) {
  await connectDb();
  const count = await adMediaCount(listingId);
  if (count + adding > AD_MEDIA_MAX) throw new PolicyViolationError(AD_MEDIA_LIMIT_MESSAGE);
}
