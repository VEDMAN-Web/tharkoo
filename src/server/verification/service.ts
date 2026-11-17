import mongoose from "mongoose";
import { AuditRepository } from "@/server/audit";
import { connectDb } from "@/lib/db";
import { ConflictError, ForbiddenError, InternalError, NotFoundError, UnauthorizedError, ValidationError, VerificationRequiredError } from "@/server/http";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent, eventIsUndone } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { AuditEvent, IdentityVerification, Listing, MediaAsset, User } from "@/server/models";
import { completeMedia, signedIdDocumentUrl, signMedia } from "@/server/media/service";
import { idCheckRequired } from "@/server/settings/id-check";

const REVIEW_ROLES = new Set(["superadmin", "admin", "trust_safety", "moderator"]);
const audit = new AuditRepository();

export function canReviewVerification(roles: string[]) {
  return roles.some((role) => REVIEW_ROLES.has(role));
}

function assertManual() {
  const provider = process.env.KYC_PROVIDER?.trim() || "manual";
  if (provider !== "manual") throw new InternalError("Manual identity review is the only available provider");
}

/** Throws unless the user's ID is approved. With the ID-check switch off (H6.14) nobody is asked, so this returns at once. */
export async function assertVerified(userId: string) {
  await connectDb();
  if (!(await idCheckRequired())) return;
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
  await connectDb();
  assertManual();
  const signed = await signMedia(userId, { ...input, kind: "id_document" }, requestId);
  return { uploadUrl: signed.uploadUrl, assetId: signed.mediaId };
}

async function ownIdDocument(userId: string, assetId: string, requestId: string) {
  if (!mongoose.isValidObjectId(assetId)) throw new ValidationError("Upload was not found");
  const asset = await MediaAsset.findById(assetId);
  if (!asset) throw new ValidationError("Upload was not found");
  if (asset.ownerId.toString() !== userId || asset.kind !== "id_document") {
    throw new ForbiddenError("Upload was not found");
  }
  if (["deleted", "rejected_csam", "rejected_policy", "failed"].includes(asset.status)) {
    throw new ValidationError("Upload was not found");
  }
  if (asset.status === "uploaded") await completeMedia(userId, assetId, requestId);
  return asset;
}

export async function submitVerification(
  userId: string,
  input: { frontAssetId: string; backAssetId?: string; selfieAssetId: string },
  requestId: string,
) {
  assertManual();
  await connectDb();
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError("Upload was not found");
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("Sign in required");
  // H7.2b: a code sign-up has no date of birth until its seller profile is saved, so the ID check waits for it.
  if (!user.dateOfBirth) throw new VerificationRequiredError("Save your seller profile first, then send your ID");
  if (user.verificationStatus === "pending_review") throw new ConflictError("A verification is already pending");
  if (user.verificationStatus === "approved") throw new ConflictError("Verification is already approved");
  await ownIdDocument(userId, input.frontAssetId, requestId);
  if (input.backAssetId) await ownIdDocument(userId, input.backAssetId, requestId);
  await ownIdDocument(userId, input.selfieAssetId, requestId);
  const row = await IdentityVerification.create({
    userId: user._id,
    provider: "manual",
    documentRef: input.frontAssetId,
    documents: {
      front: input.frontAssetId,
      ...(input.backAssetId ? { back: input.backAssetId } : {}),
      selfie: input.selfieAssetId,
    },
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

export type IdDecision = { status: "approved" | "rejected"; eventId: string; undoUntil: string | null };

/** Approve or reject one check. It goes through adminWrite: audit row, blocked-terms check on the reason, 7 day undo (Reopen). The documents are never touched. */
export async function decideVerificationWithUndo(
  actorId: string,
  roles: string[],
  verificationId: string,
  decision: "approved" | "rejected",
  reason: string,
  requestId: string,
): Promise<IdDecision> {
  assertManual();
  if (!canReviewVerification(roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const row = await IdentityVerification.findById(verificationId);
  if (!row) throw new NotFoundError("Verification not found");
  if (row.status !== "pending_review") throw new ConflictError("Verification is already decided");
  const user = await User.findById(row.userId);
  if (!user) throw new NotFoundError("Verification not found");
  const userFrom = user.verificationStatus;
  const ctx: AdminCtx = { actorId, email: "", roles, requestId };
  const written = await adminWrite<{ status: "approved" | "rejected" }>(ctx, {
    perm: "id.decide",
    action: "verification.decision",
    target: { type: "identity_verification", id: row._id.toString(), label: user.displayName },
    reason,
    texts: reason,
    undo: { kind: "id.decision", windowKey: "decisions" },
    before: async () => ({ status: "pending_review" }),
    apply: async () => {
      row.status = decision;
      row.reviewerId = new mongoose.Types.ObjectId(actorId);
      row.decisionReason = reason;
      row.decidedAt = new Date();
      await row.save();
      user.verificationStatus = decision;
      user.verificationId = row._id;
      await user.save();
      return {
        after: { status: decision },
        result: { status: decision },
        summary: `${decision === "approved" ? "Approved" : "Rejected"} an ID check`,
        undoData: { id: row._id.toString(), userId: user._id.toString(), from: decision, to: "pending_review", userFrom: decision, userTo: userFrom },
      };
    },
  });
  return { status: written.result.status, eventId: written.eventId, undoUntil: written.undoUntil };
}

export async function decideVerification(
  actorId: string,
  roles: string[],
  verificationId: string,
  decision: "approved" | "rejected",
  reason: string,
  requestId: string,
) {
  await connectDb();
  const done = await decideVerificationWithUndo(actorId, roles, verificationId, decision, reason, requestId);
  return { status: done.status };
}

export type IdTab = "waiting" | "approved" | "rejected";
export const ID_TABS: readonly IdTab[] = ["waiting", "approved", "rejected"];
export const ID_PAGE_SIZES = [25, 50, 100] as const;
const TAB_STATUS: Record<IdTab, "pending_review" | "approved" | "rejected"> = { waiting: "pending_review", approved: "approved", rejected: "rejected" };
const ADULT_AGE = 18;

export type IdQuery = { tab: IdTab; q: string; page: number; pageSize: number };

export function parseIdQuery(params: Record<string, string | string[] | undefined>): IdQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  return {
    tab: (ID_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as IdTab) : "waiting",
    q: one("q").trim().slice(0, 120),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (ID_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

export type IdRow = { id: string; name: string; email: string; status: string; since: string; decidedAt: string | null; reason: string };
export type IdList = { query: IdQuery; rows: IdRow[]; total: number; counts: Record<IdTab, number> };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listIdChecks(roles: string[], query: IdQuery): Promise<IdList> {
  assertManual();
  if (!canReviewVerification(roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  const [waiting, approved, rejected] = await Promise.all(ID_TABS.map((tab) => IdentityVerification.countDocuments({ status: TAB_STATUS[tab] })));
  const filter: Record<string, unknown> = { status: TAB_STATUS[query.tab] };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    const people = await User.find({ $or: [{ displayName: pattern }, { email: pattern }] }).select("_id").limit(200).lean();
    filter.userId = { $in: people.map((person) => person._id) };
  }
  const order: Record<string, 1 | -1> = query.tab === "waiting" ? { createdAt: 1 } : { decidedAt: -1 };
  const [total, rows] = await Promise.all([
    IdentityVerification.countDocuments(filter),
    IdentityVerification.find(filter)
      .sort(order)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .select("userId status createdAt decidedAt decisionReason")
      .lean(),
  ]);
  const people = await User.find({ _id: { $in: rows.map((row) => row.userId) } }).select("displayName email").lean<{ _id: unknown; displayName?: string; email?: string }[]>();
  const byId = new Map(people.map((person) => [String(person._id), person]));
  return {
    query,
    total,
    counts: { waiting, approved, rejected },
    rows: rows.map((row) => ({
      id: String(row._id),
      name: byId.get(String(row.userId))?.displayName || "unknown",
      email: byId.get(String(row.userId))?.email || "",
      status: row.status,
      since: new Date(row.createdAt ?? Date.now()).toISOString(),
      decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
      reason: row.decisionReason || "",
    })),
  };
}

export type IdDetail = {
  id: string;
  name: string;
  email: string;
  ads: number;
  since: string;
  status: string;
  reason: string;
  decidedAt: string | null;
  ageOnId: number | null;
  adult: boolean;
  files: { front: string; back?: string; selfie: string } | null;
  canReopen: boolean;
};

async function reopenEvent(verificationId: string) {
  const event = await AuditEvent.findOne({ action: "verification.decision", targetId: verificationId, "undo.until": { $gt: new Date() } })
    .sort({ _id: -1 })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId } | null>();
  if (!event) return null;
  return (await eventIsUndone(String(event._id))) ? null : String(event._id);
}

/** One check with its photos. Opening the photos is written to the audit log (verification.view). */
export async function getIdDetail(actorId: string, roles: string[], verificationId: string, requestId: string): Promise<IdDetail> {
  assertManual();
  if (!canReviewVerification(roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const row = await IdentityVerification.findById(verificationId).lean();
  if (!row) throw new NotFoundError("Verification not found");
  const [user, ads] = await Promise.all([
    User.findById(row.userId).select("displayName email").lean<{ displayName?: string; email?: string } | null>(),
    Listing.countDocuments({ ownerId: row.userId, status: { $in: ["active", "pending", "paused"] } }),
  ]);
  let files: IdDetail["files"] = null;
  try {
    const shown = await verificationFile(actorId, roles, verificationId, requestId);
    files = { front: shown.front.url, selfie: shown.selfie.url, ...("back" in shown && shown.back ? { back: shown.back.url } : {}) };
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }
  const born = row.dateOfBirthAsserted ? new Date(row.dateOfBirthAsserted) : null;
  const age = born ? Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  return {
    id: String(row._id),
    name: user?.displayName || "unknown",
    email: user?.email || "",
    ads,
    since: new Date(row.createdAt ?? Date.now()).toISOString(),
    status: row.status,
    reason: row.decisionReason || "",
    decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
    ageOnId: age,
    adult: age !== null && age >= ADULT_AGE,
    files,
    canReopen: row.status !== "pending_review" && (await reopenEvent(verificationId)) !== null,
  };
}

/** Reopen a decision made in the last 7 days: the check goes back to waiting and the verified badge is off until it is decided again. */
export async function reopenVerification(ctx: AdminCtx, verificationId: string) {
  assertManual();
  if (!canReviewVerification(ctx.roles)) throw new ForbiddenError("Not allowed");
  await connectDb();
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const eventId = await reopenEvent(verificationId);
  if (!eventId) throw new ConflictError("A decision can be reopened for 7 days. This one is older or already reopened.");
  const outcome = await undoEvent(ctx, eventId);
  if (!outcome.ok) throw new ConflictError(outcome.message);
  return { eventId: outcome.eventId };
}

export async function verificationFile(actorId: string, roles: string[], verificationId: string, requestId: string) {
  assertManual();
  await connectDb();
  if (!canReviewVerification(roles)) throw new ForbiddenError("Not allowed");
  if (!mongoose.isValidObjectId(verificationId)) throw new NotFoundError("Verification not found");
  const row = await IdentityVerification.findById(verificationId);
  if (!row) throw new NotFoundError("Verification not found");
  const docs = row.documents;
  const frontId = docs?.front || row.documentRef;
  if (!frontId || !docs?.selfie) throw new NotFoundError("Verification not found");
  const front = await signedIdDocumentUrl(actorId, roles, frontId);
  const selfie = await signedIdDocumentUrl(actorId, roles, docs.selfie);
  const back = docs.back ? await signedIdDocumentUrl(actorId, roles, docs.back) : undefined;
  await audit.append({
    actorId,
    actorType: "admin",
    action: "verification.view",
    targetType: "identity_verification",
    targetId: row._id.toString(),
    requestId,
    after: { expiresAt: front.expiresAt },
  });
  return back ? { front, back, selfie } : { front, selfie };
}
