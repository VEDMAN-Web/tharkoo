import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { isStaffRole } from "@/server/auth/service";
import { ForbiddenError, NotFoundError, PolicyViolationError, ValidationError } from "@/server/http";
import { Listing, MediaAsset, PromotionOrder, type ListingDoc, type MediaAssetDoc } from "@/server/models";
import { cloudinaryClient, type Delivery } from "@/server/media/client";
import { csamScannerFromEnv, type CsamScanner } from "@/server/media/csam";
import { EAGER, ID_URL_TTL_SECONDS, VIDEO_FORMAT_MIME, VIDEO_MAX_BYTES, VIDEO_MAX_PER_AD, VIDEO_MAX_SECONDS, VIDEO_RULE_MESSAGE, VIDEO_TYPES, UPLOAD_NEEDS_CLOUDINARY, onVercel, MAX_BYTES, ORPHAN_AGE_MS, STRIP_EXIF, cloudinaryEnv, optionalCloudinary, photoLimit } from "@/server/media/config";
import { signUploadParams } from "@/server/media/sign";
import { videoSeconds } from "@/server/media/duration";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const FORMAT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const CLOSED = ["deleted", "failed", "rejected_policy", "rejected_csam"] as const;
const audit = new AuditRepository();
let scannerOverride: CsamScanner | null = null;

export function setCsamScanner(scanner: CsamScanner | null) {
  scannerOverride = scanner;
}

function deliveryType(kind: MediaAssetDoc["kind"]): Delivery {
  return kind === "id_document" ? "authenticated" : "upload";
}

function assertId(value: string, message = "Media not found") {
  if (!mongoose.isValidObjectId(value)) throw new NotFoundError(message);
}

async function promoted(listing: ListingDoc & { _id: Types.ObjectId }) {
  if (listing.badges?.some((badge) => badge && badge !== "free")) return true;
  return Boolean(
    await PromotionOrder.exists({
      listingId: listing._id,
      status: "active",
      $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gt: new Date() } }],
    }),
  );
}

async function ownedListing(listingId: string, userId: string) {
  assertId(listingId, "Listing not found");
  const listing = await Listing.findById(listingId);
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.ownerId.toString() !== userId) throw new ForbiddenError("Not allowed");
  return listing;
}

function record(userId: string, action: string, targetType: string, targetId: string, requestId: string, after?: Record<string, unknown>) {
  return audit.append({ actorId: userId, actorType: "user", action, targetType, targetId, requestId, after });
}

async function loadOwned(mediaId: string, userId?: string) {
  await connectDb();
  assertId(mediaId);
  const query: Record<string, unknown> = { _id: mediaId, status: { $ne: "deleted" } };
  if (userId) query.ownerId = userId;
  const asset = await MediaAsset.findOne(query);
  if (!asset) throw new NotFoundError("Media not found");
  return asset;
}

function localFile(objectKey: string) {
  if (objectKey.startsWith("/uploads/")) return path.join(process.cwd(), "public", "uploads", path.basename(objectKey));
  if (objectKey.startsWith("private:")) return path.join(process.cwd(), "data", "id-docs", path.basename(objectKey.slice("private:".length)));
  return null;
}

export async function saveLocalMedia(
  userId: string,
  mediaId: string,
  file: { type: string; data: Buffer },
  requestId: string,
) {
  const asset = await loadOwned(mediaId, userId);
  if (asset.kind === "video") return saveLocalVideo(userId, asset, file, requestId);
  if (!ALLOWED.has(file.type) || file.data.length > MAX_BYTES) {
    asset.status = "rejected_policy";
    await asset.save();
    throw new PolicyViolationError("Only jpeg, png, and webp photos up to 8 MB are allowed");
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${asset._id.toString()}.${ext}`;
  const privateDoc = asset.kind === "id_document";
  if (privateDoc) {
    const dir = path.join(process.cwd(), "data", "id-docs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), file.data);
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), file.data);
  }
  asset.contentType = file.type;
  asset.bytes = file.data.length;
  asset.objectKey = privateDoc ? `private:${filename}` : `/uploads/${filename}`;
  asset.status = "cleared";
  asset.clearedAt = new Date();
  await asset.save();
  if (!privateDoc && asset.listingId) {
    await Listing.updateOne({ _id: asset.listingId }, { $addToSet: { mediaIds: asset._id } });
    await Listing.updateOne(
      { _id: asset.listingId, $or: [{ coverMediaId: { $exists: false } }, { coverMediaId: null }] },
      { $set: { coverMediaId: asset._id } },
    );
  }
  await record(userId, "media.complete", "media", asset._id.toString(), requestId, { status: "cleared", local: true });
  return { status: "cleared" as const, url: privateDoc ? null : asset.objectKey };
}

async function saveLocalVideo(
  userId: string,
  asset: InstanceType<typeof MediaAsset>,
  file: { type: string; data: Buffer },
  requestId: string,
) {
  const seconds = (VIDEO_TYPES as readonly string[]).includes(file.type) ? videoSeconds(file.data, file.type) : null;
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type) || file.data.length > VIDEO_MAX_BYTES || seconds === null || seconds > VIDEO_MAX_SECONDS) {
    asset.status = "rejected_policy";
    await asset.save();
    throw new PolicyViolationError(VIDEO_RULE_MESSAGE);
  }
  const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${asset._id.toString()}.${ext}`), file.data);
  asset.contentType = file.type;
  asset.bytes = file.data.length;
  asset.objectKey = `/uploads/${asset._id.toString()}.${ext}`;
  asset.status = "cleared";
  asset.clearedAt = new Date();
  await asset.save();
  await record(userId, "media.complete", "media", asset._id.toString(), requestId, { status: "cleared", local: true, kind: "video" });
  return { status: "cleared" as const, url: asset.objectKey };
}

async function assertVideoAllowed(userId: string, input: { listingId?: string; contentType: string; byteSize: number }) {
  if (!(VIDEO_TYPES as readonly string[]).includes(input.contentType) || input.byteSize > VIDEO_MAX_BYTES || !input.listingId) {
    throw new PolicyViolationError(VIDEO_RULE_MESSAGE);
  }
  const listing = await ownedListing(input.listingId, userId);
  const count = await MediaAsset.countDocuments({ listingId: listing._id, kind: "video", status: { $nin: CLOSED } });
  if (count >= VIDEO_MAX_PER_AD) throw new PolicyViolationError("Video limit reached: up to 2 videos per ad");
}

async function completeVideo(userId: string, asset: InstanceType<typeof MediaAsset>, requestId: string) {
  const client = cloudinaryClient();
  const remote = await client.resource(asset.objectKey, "upload", "video");
  if (!remote) throw new NotFoundError("Upload was not found");
  const mime = VIDEO_FORMAT_MIME[remote.format];
  if (!mime || remote.bytes > VIDEO_MAX_BYTES || !remote.duration || remote.duration > VIDEO_MAX_SECONDS) {
    await client.destroy(asset.objectKey, "upload", "video").catch(() => undefined);
    asset.status = "rejected_policy";
    await asset.save();
    throw new PolicyViolationError(VIDEO_RULE_MESSAGE);
  }
  const scan = await (scannerOverride ?? csamScannerFromEnv()).scan({ objectKey: asset.objectKey, contentType: mime, bytes: remote.bytes });
  asset.contentType = mime;
  asset.bytes = remote.bytes;
  if (scan.match) {
    asset.status = "rejected_csam";
    asset.csamMatch = { listId: scan.listId, hitId: scan.hitId };
    await asset.save();
    throw new PolicyViolationError("Upload was rejected");
  }
  asset.status = "cleared";
  asset.clearedAt = new Date();
  await asset.save();
  await record(userId, "media.complete", "media", asset._id.toString(), requestId, { status: "cleared", kind: "video" });
  return { status: "cleared" as const };
}

export async function signMedia(
  userId: string,
  input: { listingId?: string; contentType: string; byteSize: number; kind: "image" | "video" | "id_document" },
  requestId: string,
) {
  const env = optionalCloudinary();
  await connectDb();
  if (input.kind === "video") await assertVideoAllowed(userId, input);
  else if (!ALLOWED.has(input.contentType) || input.byteSize > MAX_BYTES) {
    throw new PolicyViolationError("Only jpeg, png, and webp photos up to 8 MB are allowed");
  }
  const listingId = input.kind === "id_document" ? undefined : input.listingId;
  if (input.kind === "image" && listingId) {
    const listing = await ownedListing(listingId, userId);
    const count = await MediaAsset.countDocuments({ listingId: listing._id, kind: "image", status: { $nin: CLOSED } });
    if (count >= photoLimit(await promoted(listing))) throw new PolicyViolationError("Photo limit reached");
  }
  const created = await MediaAsset.create({
    ownerId: userId,
    listingId: listingId || undefined,
    kind: input.kind,
    objectKey: "pending",
    status: "uploaded",
    contentType: input.contentType,
    bytes: input.byteSize,
  });
  const publicId = created._id.toString();
  if (!env && onVercel()) {
    await created.deleteOne();
    throw new PolicyViolationError(UPLOAD_NEEDS_CLOUDINARY);
  }
  if (!env) {
    created.objectKey = `pending-local:${publicId}`;
    await created.save();
    await record(userId, "media.sign", "media", publicId, requestId, { kind: input.kind, local: true });
    return {
      mode: "local" as const,
      timestamp: Math.floor(Date.now() / 1000),
      signature: "local",
      cloudName: "",
      apiKey: "",
      folder: "local",
      mediaId: publicId,
      params: {},
      uploadUrl: "/api/media/local",
    };
  }
  const folder = `${env.folderPrefix}/${input.kind === "id_document" ? "id" : "listings"}`;
  created.objectKey = `${folder}/${publicId}`;
  await created.save();
  const params: Record<string, string | number> = {
    timestamp: Math.floor(Date.now() / 1000),
    folder,
    public_id: publicId,
    ...(input.kind === "video" ? {} : { transformation: STRIP_EXIF }),
  };
  if (input.kind === "id_document") params.type = "authenticated";
  else if (input.kind === "image") params.eager = EAGER;
  await record(userId, "media.sign", "media", publicId, requestId, { kind: input.kind, folder });
  return {
    timestamp: params.timestamp,
    signature: signUploadParams(params, env.apiSecret),
    cloudName: env.cloudName,
    apiKey: env.apiKey,
    folder,
    mediaId: publicId,
    params,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudName}/${input.kind === "video" ? "video" : "image"}/upload`,
  };
}

export async function completeMedia(userId: string, mediaId: string, requestId: string) {
  const asset = await loadOwned(mediaId, userId);
  if (asset.objectKey.startsWith("/uploads/") || asset.objectKey.startsWith("private:")) {
    return { status: asset.status === "cleared" ? ("cleared" as const) : ("scanning" as const) };
  }
  if (asset.kind === "video") return completeVideo(userId, asset, requestId);
  const remote = await cloudinaryClient().resource(asset.objectKey, deliveryType(asset.kind));
  if (!remote) throw new NotFoundError("Upload was not found");
  const mime = FORMAT_MIME[remote.format];
  if (!mime || remote.bytes > MAX_BYTES) {
    asset.status = "rejected_policy";
    await asset.save();
    throw new PolicyViolationError("Only jpeg, png, and webp photos up to 8 MB are allowed");
  }
  const scan = await (scannerOverride ?? csamScannerFromEnv()).scan({
    objectKey: asset.objectKey,
    contentType: mime,
    bytes: remote.bytes,
  });
  asset.contentType = mime;
  asset.bytes = remote.bytes;
  if (scan.match) {
    asset.status = "rejected_csam";
    asset.csamMatch = { listId: scan.listId, hitId: scan.hitId };
    await asset.save();
    throw new PolicyViolationError("Upload was rejected");
  }
  asset.status = "scanning";
  await asset.save();
  await record(userId, "media.complete", "media", asset._id.toString(), requestId, { status: "scanning" });
  return { status: "scanning" as const };
}

export async function getMedia(userId: string, roles: string[], mediaId: string) {
  const asset = await loadOwned(mediaId);
  if (asset.ownerId.toString() !== userId && !isStaffRole(roles)) throw new ForbiddenError("Not allowed");
  return {
    id: asset._id.toString(),
    kind: asset.kind,
    status: asset.status,
    contentType: asset.contentType ?? null,
    bytes: asset.bytes ?? null,
    listingId: asset.listingId ? asset.listingId.toString() : null,
  };
}

export async function signedIdDocumentUrl(userId: string, roles: string[], mediaId: string) {
  const asset = await loadOwned(mediaId);
  if (asset.kind !== "id_document") throw new ForbiddenError("Not an identity document");
  if (asset.ownerId.toString() !== userId && !isStaffRole(roles)) throw new ForbiddenError("Not allowed");
  if (asset.objectKey.startsWith("private:")) {
    const expiresAt = Math.floor(Date.now() / 1000) + ID_URL_TTL_SECONDS;
    return {
      url: `/api/media/private/${asset._id.toString()}?expires_at=${expiresAt}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }
  const format = asset.contentType === "image/png" ? "png" : asset.contentType === "image/webp" ? "webp" : "jpg";
  const expiresAt = Math.floor(Date.now() / 1000) + ID_URL_TTL_SECONDS;
  const url = cloudinaryClient().signedDownload(asset.objectKey, format, expiresAt);
  if (url.includes("/image/upload/") || url.includes("res.cloudinary.com") || !url.includes(`expires_at=${expiresAt}`)) {
    throw new PolicyViolationError("ID document URL must not use public delivery");
  }
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function deleteMedia(userId: string, mediaId: string, requestId: string) {
  const asset = await loadOwned(mediaId);
  if (asset.ownerId.toString() !== userId) throw new ForbiddenError("Not allowed");
  const stored = localFile(asset.objectKey);
  if (stored) await unlink(stored).catch(() => undefined);
  else await cloudinaryClient().destroy(asset.objectKey, deliveryType(asset.kind), asset.kind === "video" ? "video" : "image");
  asset.status = "deleted";
  await asset.save();
  if (asset.listingId) {
    await Listing.updateOne({ _id: asset.listingId }, { $pull: { mediaIds: asset._id } });
    await Listing.updateOne({ _id: asset.listingId, coverMediaId: asset._id }, { $unset: { coverMediaId: "" } });
  }
  await record(userId, "media.delete", "media", asset._id.toString(), requestId);
  return { ok: true as const };
}

export async function reorderMedia(
  userId: string,
  input: { listingId: string; orderedMediaIds: string[]; coverId?: string },
  requestId: string,
) {
  await connectDb();
  const listing = await ownedListing(input.listingId, userId);
  const ids = input.orderedMediaIds;
  const found = await MediaAsset.countDocuments({
    _id: { $in: ids },
    ownerId: userId,
    listingId: listing._id,
    kind: "image",
    status: { $ne: "deleted" },
  });
  if (found !== ids.length) throw new ForbiddenError("Not allowed");
  if (ids.length > photoLimit(await promoted(listing))) throw new PolicyViolationError("Photo limit reached");
  const cover = input.coverId ?? ids[0];
  if (cover && !ids.includes(cover)) {
    throw new ValidationError("Invalid request", { coverId: ["Cover must be one of the photos"] });
  }
  listing.mediaIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  listing.coverMediaId = cover ? new mongoose.Types.ObjectId(cover) : undefined;
  await listing.save();
  await record(userId, "media.reorder", "listing", listing._id.toString(), requestId, { mediaIds: ids, coverMediaId: cover ?? null });
  return { mediaIds: ids, coverMediaId: cover ?? null };
}

export async function sweepOrphans(options: { dryRun?: boolean; olderThanMs?: number; now?: Date } = {}) {
  const env = cloudinaryEnv();
  await connectDb();
  const cutoff = new Date((options.now ?? new Date()).getTime() - (options.olderThanMs ?? ORPHAN_AGE_MS));
  const stale = await MediaAsset.find({ status: "uploaded", createdAt: { $lt: cutoff } });
  const known = new Set((await MediaAsset.find({ status: { $ne: "deleted" } }).select("objectKey")).map((row) => row.objectKey));
  const remoteIds = (await cloudinaryClient().list(env.folderPrefix)).filter((id) => id.startsWith(`${env.folderPrefix}/`) && !known.has(id));
  const staleIds = stale.map((row) => row._id.toString());
  if (!options.dryRun) {
    const client = cloudinaryClient();
    for (const row of stale) {
      await client.destroy(row.objectKey, deliveryType(row.kind));
      row.status = "deleted";
      await row.save();
    }
    for (const id of remoteIds) await client.destroy(id, id.includes("/id/") ? "authenticated" : "upload");
  }
  return { dryRun: Boolean(options.dryRun), staleIds, remoteIds, deleted: options.dryRun ? 0 : staleIds.length + remoteIds.length };
}
