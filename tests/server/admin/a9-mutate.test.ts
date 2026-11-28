import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: undefined as string | undefined, roles: ["admin"] as string[] }));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({ get: (name: string) => (name === "sid" && state.token ? { name, value: state.token } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/admin-auth", () => ({
  getStaffFromHeaders: async () => ({ verified: true, kind: "person", email: "staff@example.com", name: "Staff", roles: state.roles }),
  isStaff: (identity: { verified: boolean; roles: string[] }) => identity.verified && identity.roles.length > 0,
}));
vi.mock("@/lib/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cache")>()),
  refreshPublicCache: async () => undefined,
}));
import { adminMutate } from "@/app/admin/actions";
import { hashToken } from "@/server/auth/http";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError } from "@/server/http";
import { AuditEvent, BannedWord, FeatureFlag, SeoTemplate, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

async function signIn(roles: string[]) {
  state.roles = roles;
  const user = await User.create({
    email: `staff-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash: "hash",
    displayName: "Staff",
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
  state.token = `tok-${user._id}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(state.token), expiresAt: new Date(Date.now() + 86_400_000) });
  return String(user._id);
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  state.token = undefined;
});

describe("adminMutate goes through adminWrite", () => {
  it("audits an update with before, after and an undo window, and the undo restores the old record", async () => {
    const actorId = await signIn(["admin"]);
    const flag = await FeatureFlag.create({ key: "demo", label: "Old label", enabled: true });
    const done = await adminMutate({ model: "FeatureFlag", op: "update", id: String(flag._id), data: { label: "New label", enabled: false } });
    expect(done.ok).toBe(true);
    expect((await FeatureFlag.findById(flag._id).lean())?.label).toBe("New label");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "json.update", targetType: "FeatureFlag", targetId: String(flag._id), actorRole: "admin" });
    expect(String(row?.actorId)).toBe(actorId);
    expect(row?.before).toEqual({ label: "Old label", enabled: true });
    expect(row?.after).toEqual({ label: "New label", enabled: false });
    expect(row?.undo?.kind).toBe("record.restore");
    const ctx = { actorId, email: "staff@example.com", roles: ["admin"], requestId: "r" };
    expect(await undoEvent(ctx, done.eventId)).toMatchObject({ ok: true });
    const back = await FeatureFlag.findById(flag._id).lean();
    expect(back).toMatchObject({ label: "Old label", enabled: true });
    expect(await undoEvent(ctx, done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("returns a conflict when the record changed after the update", async () => {
    const actorId = await signIn(["admin"]);
    const flag = await FeatureFlag.create({ key: "demo2", label: "A", enabled: true });
    const done = await adminMutate({ model: "FeatureFlag", op: "update", id: String(flag._id), data: { label: "B" } });
    await FeatureFlag.updateOne({ _id: flag._id }, { $set: { label: "C" } });
    const result = await undoEvent({ actorId, email: "x@example.com", roles: ["admin"], requestId: "r" }, done.eventId);
    expect(result).toMatchObject({ ok: false, reason: "conflict" });
    expect((await FeatureFlag.findById(flag._id).lean())?.label).toBe("C");
  });

  it("audits a create, and refuses a blocked word in any field without writing", async () => {
    await signIn(["admin"]);
    const created = await adminMutate({ model: "FeatureFlag", op: "create", data: { key: "fresh", label: "Fresh" } });
    expect(created.undoUntil).toBeNull();
    expect(await AuditEvent.countDocuments({ action: "json.create", targetType: "FeatureFlag" })).toBe(1);
  });

  it("does not refuse the words of the banned-word list itself", async () => {
    await signIn(["admin"]);
    await adminMutate({ model: "BannedWord", op: "create", data: { text: "blockedword", matchType: "contains" } });
    expect(await BannedWord.countDocuments({ text: "blockedword" })).toBe(1);
  });

  it("makes a JSON delete superadmin only and records it as not undoable", async () => {
    await signIn(["admin"]);
    const flag = await FeatureFlag.create({ key: "gone", label: "Gone" });
    await expect(adminMutate({ model: "FeatureFlag", op: "delete", id: String(flag._id) })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await FeatureFlag.countDocuments({ key: "gone" })).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied", targetType: "FeatureFlag" })).toBe(1);
    await signIn(["superadmin"]);
    const done = await adminMutate({ model: "FeatureFlag", op: "delete", id: String(flag._id) });
    expect(await FeatureFlag.countDocuments({ key: "gone" })).toBe(0);
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "json.delete", lock: "purged" });
    expect(row?.before).toMatchObject({ key: "gone", label: "Gone" });
  });

  it("keeps the model allowlist: a seo_editor may update a SeoTemplate and nothing else", async () => {
    await signIn(["seo_editor"]);
    const template = await SeoTemplate.create({ pageType: "home", title: "Old" });
    const done = await adminMutate({ model: "SeoTemplate", op: "update", id: String(template._id), data: { title: "New" } });
    expect(done.ok).toBe(true);
    await expect(adminMutate({ model: "FeatureFlag", op: "create", data: { key: "no" } })).rejects.toThrow("Forbidden");
    expect(await FeatureFlag.countDocuments({ key: "no" })).toBe(0);
  });
});
