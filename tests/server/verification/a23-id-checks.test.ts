import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError } from "@/server/http";
import { AuditEvent, IdentityVerification, MediaAsset, User } from "@/server/models";
import { decideVerificationWithUndo, getIdDetail, listIdChecks, parseIdQuery, reopenVerification } from "@/server/verification/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();
const staffId = String(oid());
const ctx = (roles = ["moderator"]): AdminCtx => ({ actorId: staffId, email: "", roles, requestId: "r" });
const ROLES = ["moderator"];

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  delete process.env.KYC_PROVIDER;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function check(name = "Riya Thakur", born = "1998-04-02") {
  const user = await User.create({ email: `${name.split(" ")[0].toLowerCase()}@example.test`, displayName: name, roles: ["user"], status: "active", verificationStatus: "pending_review" });
  const asset = async (key: string) =>
    String((await MediaAsset.collection.insertOne({ ownerId: user._id, kind: "id_document", objectKey: `private:${key}`, contentType: "image/jpeg", status: "cleared" })).insertedId);
  const documents = { front: await asset("front"), back: await asset("back"), selfie: await asset("selfie") };
  const row = await IdentityVerification.create({ userId: user._id, provider: "manual", documentRef: documents.front, documents, status: "pending_review", dateOfBirthAsserted: new Date(born) });
  return { id: String(row._id), userId: String(user._id), documents };
}

const decide = (id: string, decision: "approved" | "rejected", reason = "Document matches", roles = ROLES) => decideVerificationWithUndo(staffId, roles, id, decision, reason, "r");

describe("the queue", () => {
  it("lists the three tabs with counts, searches by name, and refuses a role that may not review", async () => {
    const a = await check("Riya Thakur");
    const b = await check("Sneha Rao");
    await decide(b.id, "rejected", "Photo blurry");
    expect(parseIdQuery({ tab: "approved", page: "2", size: "50" })).toEqual({ tab: "approved", q: "", page: 2, pageSize: 50 });
    const waiting = await listIdChecks(ROLES, { tab: "waiting", q: "", page: 1, pageSize: 25 });
    expect(waiting.rows.map((row) => row.name)).toEqual(["Riya Thakur"]);
    expect(waiting.counts).toEqual({ waiting: 1, approved: 0, rejected: 1 });
    const rejected = await listIdChecks(ROLES, { tab: "rejected", q: "sneha", page: 1, pageSize: 25 });
    expect(rejected.rows[0]).toMatchObject({ name: "Sneha Rao", reason: "Photo blurry" });
    expect((await listIdChecks(ROLES, { tab: "waiting", q: "nobody", page: 1, pageSize: 25 })).total).toBe(0);
    await expect(listIdChecks(["support"], { tab: "waiting", q: "", page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ForbiddenError);
    expect(a.id).toBeTruthy();
  });
});

describe("decisions and Reopen", () => {
  it("approves with an audit row and Undo, and Reopen resets the user's status without touching the documents", async () => {
    const one = await check();
    const done = await decide(one.id, "approved");
    expect(done).toMatchObject({ status: "approved" });
    expect(done.undoUntil).not.toBeNull();
    expect((await User.findById(one.userId).lean())?.verificationStatus).toBe("approved");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "verification.decision", targetId: one.id, reason: "Document matches" });
    expect(row?.undo?.kind).toBe("id.decision");
    await reopenVerification(ctx(), one.id);
    const back = await IdentityVerification.findById(one.id).lean();
    expect(back?.status).toBe("pending_review");
    expect(back?.decisionReason).toBeUndefined();
    expect(back?.decidedAt).toBeUndefined();
    expect(back?.documents).toMatchObject({ front: one.documents.front, back: one.documents.back, selfie: one.documents.selfie });
    expect((await User.findById(one.userId).lean())?.verificationStatus).toBe("pending_review");
    await expect(reopenVerification(ctx(), one.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects, reopens, and the reopen can be undone to put the rejection back with its reason", async () => {
    const one = await check();
    await decide(one.id, "rejected", "Face does not match");
    const reopened = await reopenVerification(ctx(), one.id);
    expect((await IdentityVerification.findById(one.id).lean())?.status).toBe("pending_review");
    expect((await undoEvent(ctx(), reopened.eventId)).ok).toBe(true);
    const again = await IdentityVerification.findById(one.id).lean();
    expect(again).toMatchObject({ status: "rejected", decisionReason: "Face does not match" });
    expect((await User.findById(one.userId).lean())?.verificationStatus).toBe("rejected");
  });

  it("cannot be reopened after the window, and a role without the permission is refused", async () => {
    const one = await check();
    const done = await decide(one.id, "approved");
    await expect(decide(one.id, "approved")).rejects.toBeInstanceOf(ConflictError);
    await expect(decideVerificationWithUndo(staffId, ["support"], (await check("Other Person")).id, "approved", "ok", "r")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reopenVerification(ctx(["support"]), one.id)).rejects.toBeInstanceOf(ForbiddenError);
    await AuditEvent.collection.updateOne({ _id: new mongoose.Types.ObjectId(done.eventId) }, { $set: { "undo.until": new Date(Date.now() - 1000) } });
    await expect(reopenVerification(ctx(), one.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await IdentityVerification.findById(one.id).lean())?.status).toBe("approved");
  });

  it("refuses an Undo when the check changed after the decision", async () => {
    const one = await check();
    const done = await decide(one.id, "approved");
    await IdentityVerification.updateOne({ _id: one.id }, { $set: { status: "rejected" } });
    expect(await undoEvent(ctx(), done.eventId)).toMatchObject({ ok: false, reason: "conflict" });
  });
});

describe("the detail", () => {
  it("shows the three photos with signed addresses, the age on the ID, and writes the reveal to the audit log", async () => {
    const one = await check("Riya Thakur", "1998-04-02");
    const detail = await getIdDetail(staffId, ROLES, one.id, "req-view");
    expect(detail).toMatchObject({ name: "Riya Thakur", status: "pending_review", adult: true, canReopen: false });
    expect(detail.ageOnId).toBeGreaterThanOrEqual(18);
    expect(detail.files?.selfie).toContain("/api/media/private/");
    expect(detail.files?.front).toContain("expires_at=");
    expect(detail.files?.back).toBeTruthy();
    expect(await AuditEvent.countDocuments({ action: "verification.view", targetId: one.id })).toBe(1);
    const young = await check("Young Person", `${new Date().getFullYear() - 16}-01-01`);
    expect(await getIdDetail(staffId, ROLES, young.id, "r")).toMatchObject({ adult: false });
    await expect(getIdDetail(staffId, ["support"], one.id, "r")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("says a decided check can be reopened while the window is open", async () => {
    const one = await check();
    await decide(one.id, "rejected", "Photo blurry");
    expect(await getIdDetail(staffId, ROLES, one.id, "r")).toMatchObject({ status: "rejected", reason: "Photo blurry", canReopen: true });
  });
});
