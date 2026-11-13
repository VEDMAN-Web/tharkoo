import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { isStaffRole } from "@/server/auth/service";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { MediaAsset, User } from "@/server/models";
import { cloudinaryClient } from "@/server/media/client";
import { VIDEO_HIDE_REPORTS, optionalCloudinary } from "@/server/media/config";
import { VideoReport } from "@/server/reports/video-report";

const audit = new AuditRepository();

export interface AdVideo {
  id: string;
  url: string;
  /** A still frame, or null on local storage where none is generated. */
  posterUrl: string | null;
  contentType: string;
}

export interface AdminVideoRow extends AdVideo {
  listingId: string;
  ownerId: string;
  openReports: number;
  hidden: boolean;
  createdAt: string;
}

/** The public URL of a stored video and, on Cloudinary, its first-frame poster. */
export function videoUrls(objectKey: string): { url: string; posterUrl: string | null } {
  if (objectKey.startsWith("/uploads/")) return { url: `/ad/video/${path.basename(objectKey)}`, posterUrl: null };
  const env = optionalCloudinary();
  if (!env) return { url: "", posterUrl: null };
  const base = `https://res.cloudinary.com/${env.cloudName}/video/upload`;
  return { url: `${base}/f_auto,q_auto/${objectKey}`, posterUrl: `${base}/so_0,f_jpg,c_limit,w_960,q_auto/${objectKey}.jpg` };
}

function shape(asset: { _id: mongoose.Types.ObjectId; objectKey: string; contentType?: string }): AdVideo | null {
  const urls = videoUrls(asset.objectKey);
  return urls.url ? { id: asset._id.toString(), ...urls, contentType: asset.contentType || "video/mp4" } : null;
}

/** Distinct people with an open report, per video. A report that names no video counts for every video on the ad. */
async function openReportCounts(listingIds: mongoose.Types.ObjectId[]) {
  const rows = await VideoReport.find({ listingId: { $in: listingIds }, status: "open" }).select("listingId mediaId reporterIpHash").lean();
  const counts = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    const listing = row.listingId.toString();
    const key = row.mediaId ? row.mediaId.toString() : "*";
    const byKey = counts.get(listing) ?? new Map<string, Set<string>>();
    const people = byKey.get(key) ?? new Set<string>();
    people.add(row.reporterIpHash);
    byKey.set(key, people);
    counts.set(listing, byKey);
  }
  return (listing: string, media: string) => {
    const byKey = counts.get(listing);
    const people = new Set<string>([...(byKey?.get("*") ?? []), ...(byKey?.get(media) ?? [])]);
    return people.size;
  };
}

/** Videos a visitor may see: cleared, and not hidden by 3 or more open reports. */
export async function listAdVideos(listingId: string): Promise<AdVideo[]> {
  if (!mongoose.isValidObjectId(listingId)) return [];
  await connectDb();
  const assets = await MediaAsset.find({ listingId, kind: "video", status: "cleared" }).sort({ createdAt: 1 }).limit(10).lean();
  if (assets.length === 0) return [];
  const count = await openReportCounts([new mongoose.Types.ObjectId(listingId)]);
  return assets
    .filter((asset) => count(listingId, asset._id.toString()) < VIDEO_HIDE_REPORTS)
    .map(shape)
    .filter((video): video is AdVideo => video !== null);
}

/** The advertiser's own videos for an ad (shown in the post and edit forms), hidden ones included. */
export async function listOwnAdVideos(userId: string, listingId: string): Promise<AdVideo[]> {
  if (!mongoose.isValidObjectId(listingId)) return [];
  await connectDb();
  const assets = await MediaAsset.find({ listingId, ownerId: userId, kind: "video", status: "cleared" }).sort({ createdAt: 1 }).lean();
  return assets.map(shape).filter((video): video is AdVideo => video !== null);
}

/** Admin view: every live video with its open-report count, most reported first. */
export async function listVideosForAdmin(roles: string[], limit = 100): Promise<AdminVideoRow[]> {
  if (!isStaffRole(roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  const assets = await MediaAsset.find({ kind: "video", status: "cleared" }).sort({ createdAt: -1 }).limit(limit).lean();
  const listings = [...new Set(assets.map((asset) => asset.listingId?.toString()).filter(Boolean) as string[])];
  const count = await openReportCounts(listings.map((id) => new mongoose.Types.ObjectId(id)));
  const rows: AdminVideoRow[] = [];
  for (const asset of assets) {
    const video = shape(asset);
    const listingId = asset.listingId?.toString();
    if (!video || !listingId) continue;
    const openReports = count(listingId, video.id);
    rows.push({
      ...video,
      listingId,
      ownerId: asset.ownerId.toString(),
      openReports,
      hidden: openReports >= VIDEO_HIDE_REPORTS,
      createdAt: asset.createdAt ? asset.createdAt.toISOString() : "",
    });
  }
  return rows.sort((a, b) => b.openReports - a.openReports);
}

async function actorId(email: string) {
  const user = email ? await User.findOne({ email }).select("_id") : null;
  return user?._id?.toString() ?? null;
}

/** Admin removes a single video: the file is deleted, its reports are closed as actioned, and the removal is audited. */
export async function removeVideoAsAdmin(actor: { email: string; roles: string[] }, mediaId: string, reason = "") {
  if (!isStaffRole(actor.roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  if (!mongoose.isValidObjectId(mediaId)) throw new NotFoundError("Video not found");
  const asset = await MediaAsset.findOne({ _id: mediaId, kind: "video", status: { $ne: "deleted" } });
  if (!asset) throw new NotFoundError("Video not found");
  if (asset.objectKey.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", "uploads", path.basename(asset.objectKey))).catch(() => undefined);
  } else {
    await cloudinaryClient().destroy(asset.objectKey, "upload", "video").catch(() => undefined);
  }
  asset.status = "deleted";
  await asset.save();
  await VideoReport.updateMany(
    { status: "open", listingId: asset.listingId, $or: [{ mediaId: asset._id }, { mediaId: { $exists: false } }, { mediaId: null }] },
    { $set: { status: "actioned", reviewedBy: actor.email, reviewedAt: new Date() } },
  );
  await audit.append({
    actorId: await actorId(actor.email),
    actorType: "admin",
    action: "video.remove",
    targetType: "media",
    targetId: asset._id.toString(),
    after: { listingId: asset.listingId?.toString() ?? null },
    reason: reason.slice(0, 300) || undefined,
    requestId: randomUUID(),
  });
  return { removed: true as const };
}

/** Admin has reviewed the reports on an ad's videos and keeps them: reports are dismissed and the videos show again. */
export async function dismissVideoReports(actor: { email: string; roles: string[] }, listingId: string) {
  if (!isStaffRole(actor.roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  if (!mongoose.isValidObjectId(listingId)) throw new NotFoundError("Ad not found");
  const done = await VideoReport.updateMany(
    { listingId, status: "open" },
    { $set: { status: "dismissed", reviewedBy: actor.email, reviewedAt: new Date() } },
  );
  await audit.append({
    actorId: await actorId(actor.email),
    actorType: "admin",
    action: "video.reports_dismissed",
    targetType: "listing",
    targetId: listingId,
    after: { dismissed: done.modifiedCount },
    requestId: randomUUID(),
  });
  return { dismissed: done.modifiedCount };
}
