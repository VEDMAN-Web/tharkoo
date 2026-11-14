import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { displayTitle } from "@/lib/format";
import { AuditRepository } from "@/server/audit";
import { NotFoundError, PolicyViolationError } from "@/server/http";
import { promoted } from "@/server/listings/service";
import { Listing, MediaAsset, type MediaAssetDoc, type MediaStatus } from "@/server/models";
import { deleteMedia } from "@/server/media/service";
import { optionalCloudinary, photoLimit, VIDEO_RULE_MESSAGE } from "@/server/media/config";
import { videoUrls } from "@/server/media/video";

/** The owner's own photos and videos for their ads. ID documents never reach these queries. */
export type MediaFilter = "all" | "photos" | "videos";
export type MediaState = "live" | "checking" | "refused";

export const PHOTO_RULE_MESSAGE = "Photos must be JPG, PNG or WebP, up to 8 MB each.";
export const LIVE_COVER_MESSAGE = "A live ad keeps its cover photo. Make another photo the cover first.";
const LIST_LIMIT = 200;
/** Stored but not yet handed to the checker: never shown to the owner. */
const HIDDEN_STATUSES: MediaStatus[] = ["deleted", "uploaded"];
const CHECKING_STATUSES = new Set(["scanning", "processing"]);
const audit = new AuditRepository();

export interface MyMediaRow {
  id: string;
  kind: "image" | "video";
  state: MediaState;
  reason: string | null;
  url: string | null;
  posterUrl: string | null;
  bytes: number | null;
  createdAt: string;
  isCover: boolean;
  listingId: string;
  adTitle: string;
  adSlug: string | null;
  adStatus: string;
}

/** The label and the reason (for a refusal) that the owner sees for a stored asset. */
export function mediaStateOf(asset: Pick<MediaAssetDoc, "kind" | "status">): { state: MediaState; reason: string | null } {
  if (asset.status === "cleared") return { state: "live", reason: null };
  if (asset.status === "uploaded" || CHECKING_STATUSES.has(asset.status)) return { state: "checking", reason: null };
  if (asset.status === "rejected_policy") {
    return { state: "refused", reason: asset.kind === "video" ? VIDEO_RULE_MESSAGE : PHOTO_RULE_MESSAGE };
  }
  if (asset.status === "rejected_csam") return { state: "refused", reason: "This upload was rejected." };
  return { state: "refused", reason: "The upload failed. Try again." };
}

/** A small preview. Local uploads are served as they are; Cloudinary photos get a server-side thumbnail. */
export function previewUrlOf(asset: Pick<MediaAssetDoc, "kind" | "objectKey">): { url: string | null; posterUrl: string | null } {
  if (asset.kind === "video") return videoUrls(asset.objectKey);
  if (asset.objectKey.startsWith("/uploads/")) return { url: asset.objectKey, posterUrl: null };
  const env = optionalCloudinary();
  if (!env || asset.objectKey.startsWith("pending") || asset.objectKey.startsWith("private:")) return { url: null, posterUrl: null };
  const url = `https://res.cloudinary.com/${env.cloudName}/image/upload/c_fill,w_480,h_480,f_auto,q_auto/${asset.objectKey}`;
  return { url, posterUrl: null };
}

type AssetLean = MediaAssetDoc & { _id: mongoose.Types.ObjectId; createdAt?: Date };

async function rowsFor(userId: string, assets: AssetLean[]): Promise<MyMediaRow[]> {
  const listingIds = [...new Set(assets.map((asset) => asset.listingId?.toString()).filter((id): id is string => Boolean(id)))];
  const listings = listingIds.length
    ? await Listing.find({ _id: { $in: listingIds }, ownerId: userId }).select("title slug status coverMediaId").lean()
    : [];
  const byId = new Map(listings.map((listing) => [String(listing._id), listing]));
  const rows: MyMediaRow[] = [];
  for (const asset of assets) {
    const listing = asset.listingId ? byId.get(asset.listingId.toString()) : undefined;
    if (!listing) continue;
    const { state, reason } = mediaStateOf(asset);
    const preview = previewUrlOf(asset);
    rows.push({
      id: asset._id.toString(),
      kind: asset.kind === "video" ? "video" : "image",
      state,
      reason,
      ...preview,
      bytes: asset.bytes ?? null,
      createdAt: asset.createdAt ? asset.createdAt.toISOString() : "",
      isCover: asset.kind === "image" && String(listing.coverMediaId ?? "") === asset._id.toString(),
      listingId: String(listing._id),
      adTitle: displayTitle(listing.title) || "Untitled ad",
      adSlug: listing.slug ?? null,
      adStatus: listing.status ?? "",
    });
  }
  return rows;
}

/** Every photo and video the owner uploaded for their ads, newest first. */
export async function listMyMedia(userId: string, filter: MediaFilter = "all"): Promise<{ rows: MyMediaRow[]; truncated: boolean }> {
  await connectDb();
  const kinds: ("image" | "video")[] = filter === "photos" ? ["image"] : filter === "videos" ? ["video"] : ["image", "video"];
  const assets = (await MediaAsset.find({
    ownerId: userId,
    kind: { $in: kinds },
    listingId: { $exists: true, $ne: null },
    status: { $nin: HIDDEN_STATUSES },
  })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .lean()) as AssetLean[];
  return { rows: await rowsFor(userId, assets), truncated: assets.length === LIST_LIMIT };
}

export interface DraftMedia {
  photos: MyMediaRow[];
  videos: MyMediaRow[];
  /** The photos this ad may hold: free ads 1, promoted ads more (see photoLimit). */
  limit: number;
  coverId: string | null;
}

/** The owner's photos on one draft or ad, in the order the ad shows them, plus its videos. */
export async function listDraftMedia(userId: string, listingId: string): Promise<DraftMedia> {
  await connectDb();
  if (!mongoose.isValidObjectId(listingId)) throw new NotFoundError("Ad not found");
  const listing = await Listing.findOne({ _id: listingId, ownerId: userId });
  if (!listing) throw new NotFoundError("Ad not found");
  const attached = (listing.mediaIds ?? []).map((id) => id.toString());
  const assets = (await MediaAsset.find({
    ownerId: userId,
    listingId: listing._id,
    kind: { $in: ["image", "video"] as ("image" | "video")[] },
    status: { $nin: HIDDEN_STATUSES },
  })
    .sort({ createdAt: 1 })
    .lean()) as AssetLean[];
  const rows = await rowsFor(userId, assets);
  const photos = attached
    .map((id) => rows.find((row) => row.id === id && row.kind === "image"))
    .filter((row): row is MyMediaRow => Boolean(row));
  const videos = rows.filter((row) => row.kind === "video");
  return {
    photos,
    videos,
    limit: photoLimit(await promoted(listing)),
    coverId: listing.coverMediaId ? listing.coverMediaId.toString() : null,
  };
}

async function keepACover(userId: string, listingId: string) {
  const listing = await Listing.findOne({ _id: listingId, ownerId: userId });
  if (!listing || listing.coverMediaId || !listing.mediaIds?.length) return;
  listing.coverMediaId = listing.mediaIds[0];
  await listing.save();
}

/**
 * Removes one of the owner's photos or videos from its ad and closes it (the stored file is deleted).
 * A live ad keeps its cover photo, so that photo has to be replaced as the cover before it can go.
 */
export async function removeMyMedia(userId: string, mediaId: string, requestId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(mediaId)) throw new NotFoundError("Not found");
  const asset = await MediaAsset.findOne({
    _id: mediaId,
    ownerId: userId,
    kind: { $in: ["image", "video"] },
    status: { $ne: "deleted" },
  });
  if (!asset) throw new NotFoundError("Not found");
  const listingId = asset.listingId ? asset.listingId.toString() : null;
  let wasCover = false;
  if (listingId) {
    const listing = await Listing.findOne({ _id: listingId, ownerId: userId }).select("status coverMediaId");
    wasCover = asset.kind === "image" && String(listing?.coverMediaId ?? "") === mediaId;
    if (wasCover && listing?.status === "active") throw new PolicyViolationError(LIVE_COVER_MESSAGE);
  }
  await deleteMedia(userId, mediaId, requestId);
  if (listingId) await keepACover(userId, listingId);
  await audit.append({
    actorId: userId,
    actorType: "user",
    action: "media.remove",
    targetType: "listing",
    targetId: listingId ?? mediaId,
    after: { mediaId, kind: asset.kind, wasCover },
    requestId,
  });
  return { removed: true as const };
}
