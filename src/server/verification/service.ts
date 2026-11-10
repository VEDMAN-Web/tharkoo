import mongoose from "mongoose";
import { AuditRepository } from "@/server/audit";
import { connectDb } from "@/lib/db";
import { ConflictError, ForbiddenError, InternalError, NotFoundError, UnauthorizedError, VerificationRequiredError } from "@/server/http";
import { IdentityVerification, MediaAsset, User } from "@/server/models";
import { completeMedia, signedIdDocumentUrl, signMedia } from "@/server/media/service";

const REVIEW_ROLES = new Set(["superadmin", "admin", "trust_safety", "moderator"]);
const audit = new AuditRepository();

export function canReviewVerification(roles: string[]) {
  return roles.some((role) => REVIEW_ROLES.has(role));
}

function assertManual() {
  const provider = process.env.KYC_PROVIDER?.trim() || "manual";
  if (provider !== "manual") throw new InternalError("Manual identity review is the only available provider");
}

export async function assertVerified(userId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) throw new VerificationRequiredError("Identity verification is required");
  const user = await User.findById(userId).select("verificationStatus");
  if (!user || user.verificationStatus !== "approved") {
    throw new VerificationRequiredError("Identity verification is required");
  }
}

export async function uploadUrl(
  userId: string,
  input: { contentType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number },
  requestId: string,
) {
  assertManual();
  const signed = await signMedia(userId, { ...input, kind: "id_document" }, requestId);
  return { uploadUrl: signed.uploadUrl, assetId: signed.mediaId };
}

export async function submitVerification(userId: string, assetId: string, requestId: string) {
  assertManual();
  await connectDb();
  if (!mongoose.isValidObjectId(assetId) || !mongoose.isValidObjectId(userId)) {
    throw new NotFoundError("Upload was not found");
  }
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("Sign in required");
  if (user.verificationStatus === "pending_review") throw new ConflictError("A verification is already pending");
  if (user.verificationStatus === "approved") throw new ConflictError("Verification is already approved");
  const asset = await MediaAsset.findOne({
    _id: assetId,
    ownerId: userId,
    kind: "id_document",
    status: { $nin: ["deleted", "rejected_csam", "rejected_policy", "failed"] },
  });
  if (!asset) throw new NotFoundError("Upload was not found");
  if (asset.status === "uploaded") await completeMedia(userId, assetId, requestId);
  const row = await IdentityVerification.create({
    userId: user._id,
    provider: "manual",
    documentRef: assetId,
    status: "pending_review",
    dateOfBirthAsserted: user.dateOfBirth,
  });
  user.verificationStatus = "pending_review";
  user.verificationId = row._id;
  await user.save();
  return { status: "pending_review" as const };
}

export async function myStatus(userId: string) {
  await connectDb();
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("Sign in required");
  const status = user.verificationStatus;
  if (status !== "rejected" || !user.verificationId) return { status };
  const row = await IdentityVerification.findById(user.verificationId).select("decisionReason");
  return row?.decisionReason ? { status, reason: row.decisionReason } : { status };
}

export async function listPending(page: number, pageSize: number) {
  assertManual();
  await connectDb();
  const filter = { status: "pending_review" as const };
  const total = await IdentityVerification.countDocuments(filter);
  const rows = await IdentityVerification.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);
  return {
    items: rows.map((row) => ({
      id: row._id.toString(),
      userId: row.userId.toString(),
      status: row.status,
      provider: row.provider,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    })),
    total,
  };
}

export async function decideVerification(
  actorId: string,
  verificationId: string,
  decision: "approved" | "rejected",
  reason: string,
  requestId: string,
) {
  assertManual();
  await connectDb();
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const row = await IdentityVerification.findById(verificationId);
  if (!row) throw new NotFoundError("Verification not found");
  if (row.status !== "pending_review") throw new ConflictError("Verification is already decided");
  const user = await User.findById(row.userId);
  if (!user) throw new NotFoundError("Verification not found");
  row.status = decision;
  row.reviewerId = new mongoose.Types.ObjectId(actorId);
  row.decisionReason = reason;
  row.decidedAt = new Date();
  await row.save();
  user.verificationStatus = decision;
  user.verificationId = row._id;
  await user.save();
  await audit.append({
    actorId,
    actorType: "admin",
    action: "verification.decision",
    targetType: "identity_verification",
    targetId: row._id.toString(),
    requestId,
    reason,
    before: { status: "pending_review" },
    after: { status: decision },
  });
  return { status: decision };
}

export async function verificationFile(actorId: string, roles: string[], verificationId: string, requestId: string) {
  assertManual();
  await connectDb();
  if (!canReviewVerification(roles)) throw new ForbiddenError("Not allowed");
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const row = await IdentityVerification.findById(verificationId);
  if (!row) throw new NotFoundError("Verification not found");
  const file = await signedIdDocumentUrl(actorId, roles, row.documentRef);
  await audit.append({
    actorId,
    actorType: "admin",
    action: "verification.view",
    targetType: "identity_verification",
    targetId: row._id.toString(),
    requestId,
    after: { expiresAt: file.expiresAt },
  });
  return file;
}
