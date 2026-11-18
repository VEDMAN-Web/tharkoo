import mongoose, { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { canEditSite } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { isPeopleListing } from "@/server/categories/kinds";
import { ConflictError, ForbiddenError, NotFoundError, PolicyViolationError, ValidationError } from "@/server/http";
import { ImportJob } from "@/server/import/model";
import { saveSiteMediaFromCloud } from "@/server/layout/media";
import { findPartner } from "@/server/listings/import";
import { cloudinaryClient } from "@/server/media/client";
import { CLOUDINARY_FOLDER, EAGER, MAX_BYTES, STRIP_EXIF, UPLOAD_NEEDS_CLOUDINARY, VIDEO_FORMAT_MIME, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_RULE_MESSAGE, VIDEO_TYPES, onVercel, optionalCloudinary } from "@/server/media/config";
import { csamScannerFromEnv } from "@/server/media/csam";
import { signUploadParams } from "@/server/media/sign";
import { markWatermarked, watermarkTransformationFor } from "@/server/media/watermark";
import { AuditEvent, Category, MediaAsset, User } from "@/server/models";

/**
 * H13.1: staff photo and video uploads go straight from the browser to Cloudinary with a signed request, like the post-ad flow.
 * The file never passes through our server, so the 4.5 MB request limit of the host no longer applies.
 *  - `signStaffUpload` checks who may upload for which screen, checks the file's type and size, and signs one slot.
 *  - `completeStaffUpload` checks the slot was signed for this staff member, looks at what Cloudinary really holds, scans it, and records it.
 * Where Cloudinary is not set up (local development) `sign` answers mode "legacy" and the screen uses its old route.
 */

export type StaffPurpose = "ad" | "library" | "import";
export type StaffKind = "image" | "video";
export type StaffActor = { id: string; email: string; roles: string[] };

export type StaffSignInput = {
  purpose: StaffPurpose;
  kind: StaffKind;
  contentType: string;
  byteSize: number;
  ownerEmail?: string;
  jobId?: string;
  categoryId?: string;
};

export type StaffSigned =
  | { mode: "legacy" }
  | { mode: "cloudinary"; mediaId: string; uploadUrl: string; apiKey: string; timestamp: number; signature: string; folder: string; params: Record<string, string | number> };

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_FORMAT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const SIGN_ACTION = "media.staff_sign";
const audit = new AuditRepository();

/** The old routes (kept for local development) take files under 4 MB only; the host refuses bigger bodies before our code runs. */
export const LEGACY_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const LEGACY_TOO_BIG = "This file could not be uploaded (too big or a network problem). Try a smaller photo.";
export const STAFF_PHOTO_REFUSED = "Only jpeg, png and webp photos up to 8 MB are allowed";
export const STAFF_PEOPLE_NO_VIDEO = "Videos are not allowed on people listings.";
export const STAFF_NOT_SIGNED = "This upload was not started by you. Choose the file again.";

function isAdmin(roles: string[]) {
  return roles.some((role) => role === "admin" || role === "superadmin");
}

/** Who may upload for which screen: the same rule each screen had before (create ad and import: an admin; the Media library: someone who may edit the site). */
function assertAllowed(actor: StaffActor, purpose: StaffPurpose) {
  if (purpose === "library" ? !canEditSite(actor.roles) : !isAdmin(actor.roles)) throw new ForbiddenError("You cannot upload files here");
}

async function ownerIdFor(actor: StaffActor, input: StaffSignInput): Promise<string> {
  if (input.purpose === "library") return actor.id;
  if (input.purpose === "import") {
    if (!input.jobId || !Types.ObjectId.isValid(input.jobId)) throw new NotFoundError("Import not found");
    const job = await ImportJob.findById(input.jobId).select("actorId partnerId").lean<{ actorId: Types.ObjectId; partnerId: Types.ObjectId } | null>();
    if (!job || String(job.actorId) !== actor.id) throw new NotFoundError("Import not found");
    return String(job.partnerId);
  }
  const typed = (input.ownerEmail ?? "").trim();
  if (typed) return String((await findPartner(typed)).id);
  const self = await User.findById(actor.id).select("email").lean<{ email?: string } | null>();
  if (!self?.email) throw new NotFoundError("Staff account not found");
  return String((await findPartner(self.email)).id);
}

function checkFile(kind: StaffKind, contentType: string, byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) throw new ValidationError("The file is empty");
  if (kind === "image") {
    if (!PHOTO_TYPES.has(contentType) || byteSize > MAX_BYTES) throw new PolicyViolationError(STAFF_PHOTO_REFUSED);
    return;
  }
  if (!(VIDEO_TYPES as readonly string[]).includes(contentType) || byteSize > VIDEO_MAX_BYTES) throw new PolicyViolationError(VIDEO_RULE_MESSAGE);
}

async function assertVideoAllowedFor(categoryId: string | undefined) {
  if (!categoryId || !mongoose.isValidObjectId(categoryId)) return;
  const category = await Category.findById(categoryId).select("slug kind fields").lean<{ slug?: string; kind?: string; fields?: unknown } | null>();
  if (category && isPeopleListing(category)) throw new PolicyViolationError(STAFF_PEOPLE_NO_VIDEO);
}

/** Signs one upload slot for a staff member. Nothing is stored until the browser has sent the file and `completeStaffUpload` is called. */
export async function signStaffUpload(actor: StaffActor, input: StaffSignInput, requestId: string): Promise<StaffSigned> {
  await connectDb();
  assertAllowed(actor, input.purpose);
  checkFile(input.kind, input.contentType, input.byteSize);
  if (input.kind === "video") {
    if (input.purpose === "library") throw new PolicyViolationError("The Media library holds photos only.");
    await assertVideoAllowedFor(input.categoryId);
  }
  const ownerId = await ownerIdFor(actor, input);
  const env = optionalCloudinary();
  if (!env) {
    if (onVercel()) throw new ConflictError(`${UPLOAD_NEEDS_CLOUDINARY}. Add the Cloudinary settings, then try again.`);
    return { mode: "legacy" };
  }
  const mediaId = new Types.ObjectId().toHexString();
  const folder = input.purpose === "library" ? `${CLOUDINARY_FOLDER}/site` : `${env.folderPrefix}/listings`;
  if (input.purpose !== "library") {
    await MediaAsset.create({ _id: mediaId, ownerId, kind: input.kind, objectKey: `${folder}/${mediaId}`, status: "uploaded", contentType: input.contentType, bytes: input.byteSize });
  }
  const watermark = await watermarkTransformationFor(folder);
  const transformation = [input.kind === "video" ? "" : STRIP_EXIF, watermark ?? ""].filter(Boolean).join("/");
  const params: Record<string, string | number> = {
    timestamp: Math.floor(Date.now() / 1000),
    folder,
    public_id: mediaId,
    ...(transformation ? { transformation } : {}),
    ...(input.purpose === "library" ? {} : input.kind === "image" ? { eager: EAGER } : {}),
  };
  if (watermark) await markWatermarked(`${folder}/${mediaId}`);
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: SIGN_ACTION,
    targetType: "media",
    targetId: mediaId,
    after: { purpose: input.purpose, kind: input.kind, folder, ownerId, jobId: input.jobId ?? null, categoryId: input.categoryId ?? null },
    requestId,
  });
  return {
    mode: "cloudinary",
    mediaId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudName}/${input.kind === "video" ? "video" : "image"}/upload`,
    apiKey: env.apiKey,
    timestamp: Number(params.timestamp),
    signature: signUploadParams(params, env.apiSecret),
    folder,
    params,
  };
}

export type StaffCompleteInput = {
  purpose: StaffPurpose;
  mediaId: string;
  fileName?: string;
  alt?: unknown;
  tags?: unknown;
  autoAlt?: boolean;
};

type SignedSlot = { purpose: StaffPurpose; kind: StaffKind; folder: string; ownerId: string; jobId: string | null };

async function signedSlot(actor: StaffActor, mediaId: string, purpose: StaffPurpose): Promise<SignedSlot> {
  if (!mongoose.isValidObjectId(mediaId)) throw new NotFoundError("Upload was not found");
  const event = await AuditEvent.findOne({ action: SIGN_ACTION, actorId: actor.id, targetId: mediaId }).lean<{ after?: SignedSlot } | null>();
  const slot = event?.after;
  if (!slot || slot.purpose !== purpose) throw new ForbiddenError(STAFF_NOT_SIGNED);
  return slot;
}

/** Looks at the file Cloudinary really holds, refuses it with a plain sentence when it breaks a rule, and records it for the screen that asked. */
export async function completeStaffUpload(actor: StaffActor, input: StaffCompleteInput, requestId: string) {
  await connectDb();
  assertAllowed(actor, input.purpose);
  const slot = await signedSlot(actor, input.mediaId, input.purpose);
  const publicId = `${slot.folder}/${input.mediaId}`;
  const client = cloudinaryClient();
  const remote = await client.resource(publicId, "upload", slot.kind);
  if (!remote) throw new NotFoundError("Upload was not found");
  const mime = slot.kind === "video" ? VIDEO_FORMAT_MIME[remote.format] : PHOTO_FORMAT_MIME[remote.format];
  const tooLong = slot.kind === "video" && !((remote.duration ?? 0) > 0 && (remote.duration ?? 0) <= VIDEO_MAX_SECONDS);
  const tooBig = remote.bytes > (slot.kind === "video" ? VIDEO_MAX_BYTES : MAX_BYTES);
  if (!mime || tooBig || tooLong) {
    await client.destroy(publicId, "upload", slot.kind).catch(() => undefined);
    if (slot.purpose !== "library") await MediaAsset.updateOne({ _id: input.mediaId }, { $set: { status: "rejected_policy" } });
    throw new PolicyViolationError(slot.kind === "video" ? VIDEO_RULE_MESSAGE : STAFF_PHOTO_REFUSED);
  }
  const scan = await csamScannerFromEnv().scan({ objectKey: publicId, contentType: mime, bytes: remote.bytes });
  if (scan.match) {
    await client.destroy(publicId, "upload", slot.kind).catch(() => undefined);
    if (slot.purpose !== "library") await MediaAsset.updateOne({ _id: input.mediaId }, { $set: { status: "rejected_csam", csamMatch: { listId: scan.listId, hitId: scan.hitId } } });
    throw new PolicyViolationError("Upload was rejected");
  }
  if (slot.purpose === "library") {
    const email = (await User.findById(actor.id).select("email").lean<{ email?: string } | null>())?.email ?? actor.email;
    return saveSiteMediaFromCloud({
      url: remote.url ?? "",
      publicId,
      width: remote.width ?? 0,
      height: remote.height ?? 0,
      bytes: remote.bytes,
      contentType: mime as "image/jpeg" | "image/png" | "image/webp",
      alt: input.alt,
      fileName: input.fileName,
      autoAlt: input.autoAlt,
      tags: input.tags,
      email,
      roles: actor.roles,
    });
  }
  await MediaAsset.updateOne({ _id: input.mediaId }, { $set: { status: "cleared", clearedAt: new Date(), contentType: mime, bytes: remote.bytes } });
  if (slot.purpose === "import") return recordImportAsset(actor, slot, input, remote.bytes, requestId);
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "media.admin_upload",
    targetType: "media",
    targetId: input.mediaId,
    after: { ownerId: slot.ownerId, kind: slot.kind, bytes: remote.bytes, direct: true },
    requestId,
  });
  return { mediaId: input.mediaId, kind: slot.kind, name: input.fileName ?? "" };
}

/** An import file that went straight to Cloudinary: it is attached to the job like the old route did, once per file name. */
async function recordImportAsset(actor: StaffActor, slot: SignedSlot, input: StaffCompleteInput, bytes: number, requestId: string) {
  if (!slot.jobId || !Types.ObjectId.isValid(slot.jobId)) throw new NotFoundError("Import not found");
  const job = await ImportJob.findById(slot.jobId);
  if (!job || String(job.actorId) !== actor.id) throw new NotFoundError("Import not found");
  if (job.state === "done") throw new ConflictError("This import has already finished");
  const wantedList = slot.kind === "video" ? job.videosToUpload : job.filesToUpload;
  const wanted = wantedList.find((name: string) => name.toLowerCase() === (input.fileName ?? "").trim().toLowerCase());
  if (!wanted) throw new ValidationError(`${input.fileName ?? "This file"} is not used by a row in this import`);
  const done = slot.kind === "video" ? job.uploadedVideos : job.uploaded;
  if (done.some((file: { name: string }) => file.name.toLowerCase() === wanted.toLowerCase())) {
    await MediaAsset.updateOne({ _id: input.mediaId }, { $set: { status: "deleted" } });
    return { status: "exists" as const, name: wanted };
  }
  await ImportJob.updateOne({ _id: job._id }, { $push: slot.kind === "video" ? { uploadedVideos: { name: wanted, mediaId: input.mediaId } } : { uploaded: { name: wanted, mediaId: input.mediaId } } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "media.import.upload",
    targetType: "media",
    targetId: input.mediaId,
    after: { jobId: String(job._id), name: wanted, bytes, kind: slot.kind, direct: true },
    requestId,
  });
  return { status: "cleared" as const, name: wanted };
}
