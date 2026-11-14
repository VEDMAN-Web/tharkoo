import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { isSiteMediaType, readImageSize } from "@/server/layout/media";
import { cloudinaryClient, uploadToCloudinary } from "@/server/media/client";
import { CLOUDINARY_FOLDER, MAX_BYTES, STRIP_EXIF, UPLOAD_NEEDS_CLOUDINARY, onVercel, optionalCloudinary } from "@/server/media/config";
import { csamScannerFromEnv } from "@/server/media/csam";
import { ConflictError, ForbiddenError, NotFoundError, PolicyViolationError, ValidationError } from "@/server/http";
import {
  assertPublishRight,
  dryRunImport,
  importPlanRange,
  prepareImport,
  recordImportAudit,
  refreshCaches,
  uploadedFromNames,
  type DryRunReport,
  type ImportActor,
  type ImportStatus,
} from "@/server/listings/import";
import { IMPORT_CHUNK_ROWS } from "@/server/import/rules";
import { ImportJob, type ImportJobDoc, type ImportJobRowResult, type ImportJobState } from "@/server/import/model";
import { MediaAsset } from "@/server/models";

const audit = new AuditRepository();
/** A chunk that has run longer than this is treated as abandoned, so a closed tab cannot block the job forever. */
const LOCK_MS = 2 * 60 * 1000;
const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type JobDoc = ImportJobDoc & { _id: Types.ObjectId };
type Uploaded = Map<string, { name: string; mediaId: string }>;

export interface JobSummary {
  jobId: string;
  partnerEmail: string;
  publishStatus: ImportStatus;
  state: ImportJobState;
  total: number;
  nextRow: number;
  imported: number;
  failed: number;
  filesToUpload: string[];
  uploadedFiles: string[];
  rowResults: ImportJobRowResult[];
}

function assertStaff(actor: ImportActor) {
  if (!actor.roles.some((role) => role === "admin" || role === "superadmin")) throw new ForbiddenError("Not allowed");
}

async function loadOwnedJob(actor: ImportActor, jobId: string): Promise<JobDoc> {
  assertStaff(actor);
  await connectDb();
  if (!Types.ObjectId.isValid(jobId)) throw new NotFoundError("Import not found");
  const job = await ImportJob.findById(jobId);
  if (!job || job.actorId.toString() !== actor.id) throw new NotFoundError("Import not found");
  return job as JobDoc;
}

/** Uploaded photos of one job, keyed by lower-cased file name. */
function uploadedFor(job: JobDoc): Uploaded {
  return new Map(job.uploaded.map((file) => [file.name.toLowerCase(), { name: file.name, mediaId: file.mediaId }] as const));
}

function summarise(job: JobDoc, uploaded: Uploaded): JobSummary {
  return {
    jobId: job._id.toString(),
    partnerEmail: job.partnerEmail,
    publishStatus: job.publishStatus,
    state: job.state,
    total: job.total,
    nextRow: job.nextRow,
    imported: job.imported,
    failed: job.failed,
    filesToUpload: job.filesToUpload,
    uploadedFiles: [...uploaded.values()].map((file) => file.name),
    rowResults: job.rowResults.map((row) => ({ line: row.line, title: row.title, ok: row.ok, errors: row.errors })),
  };
}

/** Step 2a: checks the file, then saves the job. Nothing is imported and no photo is uploaded yet. */
export async function createImportJob(
  actor: ImportActor,
  input: { partnerEmail: string; csv: string; fileNames: string[]; status: ImportStatus },
  requestId: string,
): Promise<{ job: JobSummary; report: DryRunReport }> {
  assertStaff(actor);
  assertPublishRight(actor, input.status);
  const report = await dryRunImport(actor, input.partnerEmail, input.csv, input.fileNames);
  if (report.okCount === 0) throw new ValidationError("No row can be imported yet. Fix the rows shown in the check first.");
  await connectDb();
  const filesToUpload = report.photos.filesToUpload;
  const job = (await ImportJob.create({
    actorId: new Types.ObjectId(actor.id),
    partnerId: new Types.ObjectId(report.partner.id),
    partnerEmail: report.partner.email,
    publishStatus: input.status,
    state: filesToUpload.length ? "uploading" : "importing",
    csv: input.csv,
    fileNames: input.fileNames,
    filesToUpload,
    total: report.total,
    nextRow: 0,
    imported: 0,
    failed: 0,
    rowResults: [],
    uploaded: [],
  })) as JobDoc;
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "listing.import.start",
    targetType: "user",
    targetId: report.partner.id,
    after: { jobId: job._id.toString(), rows: report.total, ready: report.okCount, photos: filesToUpload.length, status: input.status },
    requestId,
  });
  return { job: summarise(job, new Map()), report };
}

/** The unfinished job of this staff member, if any, so that a reload can continue it. */
export async function openImportJob(actor: ImportActor): Promise<JobSummary | null> {
  assertStaff(actor);
  await connectDb();
  const job = (await ImportJob.findOne({ actorId: actor.id, state: { $ne: "done" } }).sort({ updatedAt: -1 })) as JobDoc | null;
  if (!job) return null;
  return summarise(job, uploadedFor(job));
}

export async function getImportJob(actor: ImportActor, jobId: string): Promise<JobSummary> {
  const job = await loadOwnedJob(actor, jobId);
  return summarise(job, uploadedFor(job));
}

async function removeStored(objectKey: string) {
  if (objectKey.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", "uploads", path.basename(objectKey))).catch(() => undefined);
  } else {
    await cloudinaryClient().destroy(objectKey, "upload").catch(() => undefined);
  }
}

async function storeImage(file: { name: string; type: string; data: Buffer }, id: Types.ObjectId): Promise<string> {
  if (optionalCloudinary()) {
    const stored = await uploadToCloudinary(file.data, {
      contentType: file.type,
      folder: `${CLOUDINARY_FOLDER}/listings`,
      publicId: id.toHexString(),
      transformation: STRIP_EXIF,
    });
    return stored.publicId;
  }
  if (onVercel()) throw new ConflictError(`${UPLOAD_NEEDS_CLOUDINARY}. Add the Cloudinary settings, then try again.`);
  const name = `${id.toHexString()}.${EXTENSION[file.type]}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), file.data);
  return `/uploads/${name}`;
}

/** Step 2b: stores one chosen image as a photo of the partner. Same checks as a normal photo upload. */
export async function recordImportPhoto(
  actor: ImportActor,
  jobId: string,
  file: { name: string; type: string; data: Buffer },
  requestId: string,
): Promise<{ status: "cleared" | "exists"; name: string }> {
  const job = await loadOwnedJob(actor, jobId);
  if (job.state === "done") throw new ConflictError("This import has already finished");
  const wanted = job.filesToUpload.find((name) => name.toLowerCase() === file.name.trim().toLowerCase());
  if (!wanted) throw new ValidationError(`${file.name} is not used by a row in this import`);
  if ((uploadedFor(job)).has(wanted.toLowerCase())) return { status: "exists", name: wanted };
  if (!isSiteMediaType(file.type) || file.data.length === 0 || file.data.length > MAX_BYTES) {
    throw new PolicyViolationError("Only jpeg, png, and webp photos up to 8 MB are allowed");
  }
  if (!readImageSize(file.data, file.type)) throw new ValidationError(`${file.name} is not a valid jpeg, png or webp image`);
  const id = new Types.ObjectId();
  const objectKey = await storeImage(file, id);
  const scan = await csamScannerFromEnv().scan({ objectKey, contentType: file.type, bytes: file.data.length });
  if (scan.match) {
    await removeStored(objectKey);
    throw new PolicyViolationError("Upload was rejected");
  }
  await MediaAsset.create({
    _id: id,
    ownerId: job.partnerId,
    kind: "image",
    objectKey,
    status: "cleared",
    clearedAt: new Date(),
    contentType: file.type,
    bytes: file.data.length,
  });
  await ImportJob.updateOne({ _id: job._id }, { $push: { uploaded: { name: wanted, mediaId: id.toHexString() } } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "media.import.upload",
    targetType: "media",
    targetId: id.toHexString(),
    after: { jobId: job._id.toString(), name: wanted, bytes: file.data.length },
    requestId,
  });
  return { status: "cleared", name: wanted };
}

/** Takes the job for one request. Fails if another request holds it and the hold is not stale. */
async function claim(jobId: Types.ObjectId) {
  const stale = new Date(Date.now() - LOCK_MS);
  const result = await ImportJob.updateOne(
    { _id: jobId, $or: [{ runningSince: null }, { runningSince: { $exists: false } }, { runningSince: { $lt: stale } }] },
    { $set: { runningSince: new Date() } },
  );
  if (result.modifiedCount === 0) {
    throw new ConflictError("This import is already running in another window. Wait for it to finish, then reload.");
  }
}

/** Step 2c: imports the next block of rows and saves progress. The page calls this again until `state` is done. */
export async function runImportChunk(actor: ImportActor, jobId: string, requestId: string, chunkRows = IMPORT_CHUNK_ROWS): Promise<JobSummary> {
  const job = await loadOwnedJob(actor, jobId);
  if (job.state === "done") return summarise(job, uploadedFor(job));
  assertPublishRight(actor, job.publishStatus);
  const uploaded = uploadedFor(job);
  const missing = job.filesToUpload.filter((name) => !uploaded.has(name.toLowerCase()));
  if (missing.length) {
    throw new ValidationError(`${missing.length} photo${missing.length === 1 ? " is" : "s are"} still to upload: ${missing.slice(0, 5).join(", ")}`);
  }
  await claim(job._id);
  try {
    const known = new Map([...uploaded.entries()].map(([key, file]) => [key, file.mediaId] as const));
    const files = uploadedFromNames(job.fileNames, known);
    const prepared = await prepareImport(actor, job.partnerEmail, job.csv, files);
    if (prepared.partner.id !== job.partnerId.toString()) throw new ConflictError("The partner account changed. Start a new import.");
    const from = job.nextRow;
    const to = Math.min(from + chunkRows, prepared.plans.length);
    const { imported, failed } = await importPlanRange(prepared, from, to, actor, job.publishStatus, requestId);
    const rows = prepared.plans.slice(from, to).map((plan) => plan.report);
    const done = to >= prepared.plans.length;
    await ImportJob.updateOne(
      { _id: job._id },
      {
        $set: { nextRow: to, state: done ? "done" : "importing" },
        $inc: { imported, failed },
        $push: { rowResults: { $each: rows } },
      },
    );
    if (done) {
      await recordImportAudit(actor, job.partnerId.toString(), requestId, {
        rows: job.total,
        imported: job.imported + imported,
        failed: job.failed + failed,
        status: job.publishStatus,
        jobId: job._id.toString(),
      });
      if (job.publishStatus === "active") await refreshCaches();
    }
  } finally {
    await ImportJob.updateOne({ _id: job._id }, { $set: { runningSince: null } });
  }
  return getImportJob(actor, jobId);
}
