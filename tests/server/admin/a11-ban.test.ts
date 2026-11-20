import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { banPreview, banUser, logoutEverywhere, unbanUser } from "@/server/admin/user-actions";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const trust: AdminCtx = { actorId: "000000000000000000000011", email: "trust@example.com", roles: ["trust_safety"], requestId: "req-t" };
const support: AdminCtx = { actorId: "000000000000000000000012", email: "support@example.com", roles: ["support"], requestId: "req-s" };
const moderator: AdminCtx = { actorId: "000000000000000000000013", email: "mod@example.com", roles: ["moderator"], requestId: "req-m" };

async function person(email: string, extra: Record<string, unknown> = {}) {
  return User.create({ email, passwordHash: "x", displayName: email.split("@")[0], roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01"), ...extra });
}

async function ad(ownerId: unknown, title: string, status: string) {
  const row = await Listing.collection.insertOne({ ownerId, title, status, slug: `${title.toLowerCase().replace(/\W+/g, "-")}-${Math.floor(Math.random() * 1e6)}`, createdAt: new Date() });
  return String(row.insertedId);
}

async function session(userId: unknown, token: string) {
  await Session.collection.insertOne({ userId, tokenHash: token, expiresAt: new Date(Date.now() + 1e7), createdAt: new Date() });
}

async function seed() {
  const seller = await person("seller@example.com");
  const live1 = await ad(seller._id, "Live one", "active");
  const live2 = await ad(seller._id, "Live two", "active");
  const sellerPaused = await ad(seller._id, "Paused by seller", "paused");
  const draft = await ad(seller._id, "A draft", "draft");
  await session(seller._id, "s1");
  await session(seller._id, "s2");
  return { seller, live1, live2, sellerPaused, draft };
}

const statusOf = async (id: string) => (await Listing.findById(id).select("status").lean())?.status;

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
});

describe("ban", () => {
  it("pauses the live ads, ends every session, suspends the user and keeps the ad ids in the undo data", async () => {
    const data = await seed();
    expect(await banPreview(String(data.seller._id))).toEqual({ liveAds: 2, sessions: 2 });
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam: 14 ads in 5 minutes" });
    expect((await User.findById(data.seller._id))?.status).toBe("suspended");
    expect(await statusOf(data.live1)).toBe("paused");
    expect(await statusOf(data.live2)).toBe("paused");
    expect(await statusOf(data.sellerPaused)).toBe("paused");
    expect(await statusOf(data.draft)).toBe("draft");
    expect(await Session.countDocuments({ userId: data.seller._id, revokedAt: { $exists: false } })).toBe(0);
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "user.ban", targetType: "user", targetId: String(data.seller._id), actorRole: "trust_safety", reason: "Spam: 14 ads in 5 minutes" });
    expect(row?.undo?.kind).toBe("user.ban");
    expect((row?.undo?.data as { pausedListingIds: string[] }).pausedListingIds.sort()).toEqual([data.live1, data.live2].sort());
    expect(row?.summary).toContain("2 ads paused");
    expect(done.undoUntil).not.toBeNull();
  });

  it("needs the permission (support and moderators cannot), a reason, and no blocked words", async () => {
    const data = await seed();
    const userId = String(data.seller._id);
    await expect(banUser(support, { userId, reason: "Spam" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(banUser(moderator, { userId, reason: "Spam" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(2);
    await expect(banUser(trust, { userId, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    expect((await User.findById(userId))?.status).toBe("active");
    expect(await statusOf(data.live1)).toBe("active");
    expect(await AuditEvent.countDocuments({ action: "user.ban" })).toBe(0);
  });

  it("refuses your own account, staff accounts, a banned user and an unknown user", async () => {
    const data = await seed();
    const staff = await person("staff@example.com", { roles: ["support"] });
    await expect(banUser({ ...trust, actorId: String(data.seller._id) }, { userId: String(data.seller._id), reason: "Spam" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(banUser(trust, { userId: String(staff._id), reason: "Spam" })).rejects.toBeInstanceOf(ForbiddenError);
    await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    await expect(banUser(trust, { userId: String(data.seller._id), reason: "Spam" })).rejects.toBeInstanceOf(ConflictError);
    await expect(banUser(trust, { userId: "0123456789abcdef01234567", reason: "Spam" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("undo of a ban", () => {
  it("brings back only the ads the ban paused; the ad the seller had paused stays paused; sessions are not restored", async () => {
    const data = await seed();
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    const undone = await undoEvent(trust, done.eventId);
    expect(undone.ok).toBe(true);
    expect((await User.findById(data.seller._id))?.status).toBe("active");
    expect(await statusOf(data.live1)).toBe("active");
    expect(await statusOf(data.live2)).toBe("active");
    expect(await statusOf(data.sellerPaused)).toBe("paused");
    expect(await statusOf(data.draft)).toBe("draft");
    expect(await Session.countDocuments({ userId: data.seller._id, revokedAt: { $exists: false } })).toBe(0);
    const again = await undoEvent(trust, done.eventId);
    expect(again).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("leaves an ad alone when it is no longer paused or no longer theirs", async () => {
    const data = await seed();
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    await Listing.updateOne({ _id: data.live1 }, { $set: { status: "removed" } });
    await undoEvent(trust, done.eventId);
    expect(await statusOf(data.live1)).toBe("removed");
    expect(await statusOf(data.live2)).toBe("active");
  });

  it("runs again as a redo: the undo of the undo bans once more with the same ads", async () => {
    const data = await seed();
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    const undone = await undoEvent(trust, done.eventId);
    if (!undone.ok) throw new Error("undo failed");
    const redone = await undoEvent(trust, undone.eventId);
    expect(redone.ok).toBe(true);
    expect((await User.findById(data.seller._id))?.status).toBe("suspended");
    expect(await statusOf(data.live1)).toBe("paused");
    expect(await statusOf(data.live2)).toBe("paused");
    expect(await statusOf(data.sellerPaused)).toBe("paused");
  });

  it("refuses when support tries, and when the user was already unbanned by hand", async () => {
    const data = await seed();
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    expect(await undoEvent(support, done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    await User.updateOne({ _id: data.seller._id }, { $set: { status: "active" } });
    expect(await undoEvent(trust, done.eventId)).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("restores only from the saved undo data: an event without it cannot be undone and changes nothing", async () => {
    const data = await seed();
    await User.updateOne({ _id: data.seller._id }, { $set: { status: "suspended" } });
    await Listing.updateOne({ _id: data.live1 }, { $set: { status: "paused" } });
    const written = await adminWrite(trust, {
      perm: "users.ban",
      action: "user.ban",
      target: { type: "user", id: String(data.seller._id) },
      undo: { kind: "user.ban", windowKey: "decisions" },
      before: async () => null,
      apply: async () => ({ after: null, result: null, summary: "Banned without saved ads" }),
    });
    expect(await undoEvent(trust, written.eventId)).toMatchObject({ ok: false, reason: "not_undoable" });
    expect(await statusOf(data.live1)).toBe("paused");
    expect((await User.findById(data.seller._id))?.status).toBe("suspended");
  });
});

describe("unban", () => {
  it("resumes only the ads the ban paused and leaves the seller's own paused ad paused", async () => {
    const data = await seed();
    await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    const done = await unbanUser(trust, { userId: String(data.seller._id) });
    expect((await User.findById(data.seller._id))?.status).toBe("active");
    expect(await statusOf(data.live1)).toBe("active");
    expect(await statusOf(data.live2)).toBe("active");
    expect(await statusOf(data.sellerPaused)).toBe("paused");
    expect(await Session.countDocuments({ userId: data.seller._id, revokedAt: { $exists: false } })).toBe(0);
    expect((await AuditEvent.findById(done.eventId).lean())?.action).toBe("user.unban");
    await expect(unbanUser(trust, { userId: String(data.seller._id) })).rejects.toBeInstanceOf(ConflictError);
  });

  it("only changes the status when there is no ban record to follow", async () => {
    const data = await seed();
    await User.updateOne({ _id: data.seller._id }, { $set: { status: "suspended" } });
    await Listing.updateOne({ _id: data.live1 }, { $set: { status: "paused" } });
    await unbanUser(trust, { userId: String(data.seller._id) });
    expect((await User.findById(data.seller._id))?.status).toBe("active");
    expect(await statusOf(data.live1)).toBe("paused");
  });

  it("does not follow a ban that was already undone", async () => {
    const data = await seed();
    const done = await banUser(trust, { userId: String(data.seller._id), reason: "Spam" });
    await undoEvent(trust, done.eventId);
    await banUser(trust, { userId: String(data.seller._id), reason: "Spam again" });
    await Listing.updateOne({ _id: data.live2 }, { $set: { status: "paused" } });
    await unbanUser(trust, { userId: String(data.seller._id) });
    expect(await statusOf(data.live1)).toBe("active");
  });
});

describe("log out everywhere", () => {
  it("ends every session and changes nothing else; support may do it, moderators may not", async () => {
    const data = await seed();
    const done = await logoutEverywhere(support, { userId: String(data.seller._id) });
    expect(await Session.countDocuments({ userId: data.seller._id, revokedAt: { $exists: false } })).toBe(0);
    expect((await User.findById(data.seller._id))?.status).toBe("active");
    expect(await statusOf(data.live1)).toBe("active");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "user.logout_everywhere", actorRole: "support" });
    expect(row?.undo).toBeUndefined();
    await expect(logoutEverywhere(moderator, { userId: String(data.seller._id) })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
