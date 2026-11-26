import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { adminWrite } from "@/server/admin/write";
import { debitWallet, walletBalance } from "@/server/billing/ledger";
import { adjustCredits, getCreditsTab, MAX_ADJUST } from "@/server/billing/staff-credits";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, User, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const finance: AdminCtx = { actorId: "000000000000000000000021", email: "fin@example.com", roles: ["finance"], requestId: "req-f" };
const support: AdminCtx = { actorId: "000000000000000000000022", email: "sup@example.com", roles: ["support"], requestId: "req-s" };
const otherSupport: AdminCtx = { actorId: "000000000000000000000023", email: "sup2@example.com", roles: ["support"], requestId: "req-s2" };
const moderator: AdminCtx = { actorId: "000000000000000000000024", email: "mod@example.com", roles: ["moderator"], requestId: "req-m" };

let counter = 0;
const key = () => `key-${String(++counter).padStart(8, "0")}`;

async function person(email: string) {
  return User.create({ email, passwordHash: "x", displayName: email.split("@")[0], roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01") });
}

/** Takes credits away the way an ad fee would (a user debit), to make "spent" credits. */
async function spend(userId: unknown, amount: number) {
  await debitWallet({ userId: String(userId), amount, refType: "posting_fee", refId: `fee-${++counter}`, requestId: "req-spend" });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await WalletEntry.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("adjustCredits", () => {
  it("adds credits as one staff_adjust ledger line with the reason, an audit event and the delta in the undo data", async () => {
    const user = await person("riya@example.com");
    const done = await adjustCredits(support, { userId: String(user._id), amount: 50, reason: "Goodwill: late reply", requestKey: key() });
    expect(done.balance).toBe(50);
    expect(await walletBalance(String(user._id))).toBe(50);
    const line = await WalletEntry.findOne({ userId: user._id, refType: "staff_adjust" }).lean();
    expect(line).toMatchObject({ delta: 50, balanceAfter: 50 });
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "wallet.adjust", targetType: "user", targetId: String(user._id), actorRole: "support", reason: "Goodwill: late reply" });
    expect(row?.undo?.kind).toBe("wallet.adjust");
    expect(row?.undo?.data).toEqual({ delta: 50 });
    expect(done.undoUntil).not.toBeNull();
  });

  it("removes credits but never takes the balance below 0", async () => {
    const user = await person("riya@example.com");
    await adjustCredits(finance, { userId: String(user._id), amount: 20, reason: "Start", requestKey: key() });
    const removed = await adjustCredits(finance, { userId: String(user._id), amount: -15, reason: "Fix a mistake", requestKey: key() });
    expect(removed.balance).toBe(5);
    await expect(adjustCredits(finance, { userId: String(user._id), amount: -6, reason: "Too much", requestKey: key() })).rejects.toBeInstanceOf(ConflictError);
    expect(await walletBalance(String(user._id))).toBe(5);
    expect(await AuditEvent.countDocuments({ action: "wallet.adjust" })).toBe(2);
  });

  it("needs a wallet permission and a reason, and refuses blocked words, empty and silly amounts", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    await expect(adjustCredits(moderator, { userId, amount: 5, reason: "Nice", requestKey: key() })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
    await expect(adjustCredits(finance, { userId, amount: 5, reason: "  ", requestKey: key() })).rejects.toBeInstanceOf(ValidationError);
    await expect(adjustCredits(finance, { userId, amount: 5, reason: "a blockedword here", requestKey: key() })).rejects.toBeInstanceOf(ValidationError);
    for (const amount of [0, 1.5, Number.NaN, MAX_ADJUST + 1, -(MAX_ADJUST + 1)]) {
      await expect(adjustCredits(finance, { userId, amount, reason: "Goodwill", requestKey: key() })).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(adjustCredits(finance, { userId, amount: 5, reason: "Goodwill", requestKey: "short" })).rejects.toBeInstanceOf(ValidationError);
    await expect(adjustCredits(finance, { userId: "0123456789abcdef01234567", amount: 5, reason: "Goodwill", requestKey: key() })).rejects.toBeInstanceOf(NotFoundError);
    expect(await WalletEntry.countDocuments({})).toBe(0);
  });

  it("a repeated request key adds nothing twice", async () => {
    const user = await person("riya@example.com");
    const requestKey = key();
    await adjustCredits(finance, { userId: String(user._id), amount: 10, reason: "Goodwill", requestKey });
    await expect(adjustCredits(finance, { userId: String(user._id), amount: 10, reason: "Goodwill", requestKey })).rejects.toBeInstanceOf(ConflictError);
    expect(await walletBalance(String(user._id))).toBe(10);
    expect(await AuditEvent.countDocuments({ action: "wallet.adjust" })).toBe(1);
  });
});

describe("undo of a credit change", () => {
  it("add 50 then undo writes a reversing line and the balance returns; a second undo is refused", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    const done = await adjustCredits(support, { userId, amount: 50, reason: "Goodwill", requestKey: key() });
    const undone = await undoEvent(support, done.eventId);
    expect(undone.ok).toBe(true);
    expect(await walletBalance(userId)).toBe(0);
    const back = await WalletEntry.findOne({ userId: user._id, refType: "staff_adjust_undo" }).lean();
    expect(back).toMatchObject({ delta: -50, balanceAfter: 0 });
    expect(await undoEvent(support, done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("is blocked when the credits were spent, says so, and changes nothing", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    const done = await adjustCredits(finance, { userId, amount: 50, reason: "Goodwill", requestKey: key() });
    await spend(user._id, 30);
    const outcome = await undoEvent(finance, done.eventId);
    expect(outcome).toMatchObject({ ok: false, reason: "conflict" });
    expect(outcome.ok ? "" : outcome.message).toContain("Only 20 credits of these 50 credits are left");
    expect(await walletBalance(userId)).toBe(20);
    await spend(user._id, 20);
    const all = await undoEvent(finance, done.eventId);
    expect(all.ok ? "" : all.message).toContain("already spent");
    expect(await WalletEntry.countDocuments({ refType: "staff_adjust_undo" })).toBe(0);
  });

  it("undo of a removal gives the credits back, and the redo takes them away again", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    await adjustCredits(finance, { userId, amount: 40, reason: "Start", requestKey: key() });
    const removed = await adjustCredits(finance, { userId, amount: -25, reason: "Fix a mistake", requestKey: key() });
    const undone = await undoEvent(finance, removed.eventId);
    expect(undone.ok).toBe(true);
    expect(await walletBalance(userId)).toBe(40);
    if (!undone.ok) throw new Error("undo failed");
    const redone = await undoEvent(finance, undone.eventId);
    expect(redone.ok).toBe(true);
    expect(await walletBalance(userId)).toBe(15);
  });

  it("support can undo their own change but not another person's; finance can undo any", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    const mine = await adjustCredits(support, { userId, amount: 5, reason: "Goodwill", requestKey: key() });
    const theirs = await adjustCredits(otherSupport, { userId, amount: 7, reason: "Goodwill", requestKey: key() });
    expect(await undoEvent(support, theirs.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    expect((await undoEvent(support, mine.eventId)).ok).toBe(true);
    expect((await undoEvent(finance, theirs.eventId)).ok).toBe(true);
    expect(await walletBalance(userId)).toBe(0);
    expect(await undoEvent(moderator, mine.eventId)).toMatchObject({ ok: false });
  });

  it("restores only from the saved undo data: an event without it cannot be undone and changes nothing", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    await adjustCredits(finance, { userId, amount: 30, reason: "Start", requestKey: key() });
    const written = await adminWrite(finance, {
      perm: "wallet.adjust",
      action: "wallet.adjust",
      target: { type: "user", id: userId },
      undo: { kind: "wallet.adjust", windowKey: "credits" },
      before: async () => null,
      apply: async () => ({ after: null, result: null, summary: "Credit change without saved data" }),
    });
    expect(await undoEvent(finance, written.eventId)).toMatchObject({ ok: false, reason: "not_undoable" });
    expect(await walletBalance(userId)).toBe(30);
  });
});

describe("getCreditsTab", () => {
  it("shows balance, 30 day spend and lines with who added what, and the undo state of each staff change", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    const actor = await person("rohan@example.com");
    const ctx: AdminCtx = { ...support, actorId: String(actor._id) };
    const fresh = await adjustCredits(ctx, { userId, amount: 10, reason: "Goodwill", requestKey: key() });
    await spend(user._id, 4);
    const tab = await getCreditsTab(userId, ["finance"], finance.actorId);
    expect(tab.balance).toBe(6);
    expect(tab.spent30).toBe(4);
    expect(tab.total).toBe(2);
    const staff = tab.lines.find((line) => line.staff);
    expect(staff?.title).toBe("Added by rohan · Goodwill");
    expect(staff?.staff).toMatchObject({ eventId: fresh.eventId, state: "partly_spent", left: 6 });
    expect(tab.lines.find((line) => line.delta === -4)?.title).toBe("Posting fee");
  });

  it("marks a change not yours for support, undone after an undo, and refuses a role without wallet access", async () => {
    const user = await person("riya@example.com");
    const userId = String(user._id);
    const done = await adjustCredits(finance, { userId, amount: 10, reason: "Goodwill", requestKey: key() });
    const asSupport = await getCreditsTab(userId, ["support"], support.actorId);
    expect(asSupport.lines[0].staff?.state).toBe("not_yours");
    await undoEvent(finance, done.eventId);
    const after = await getCreditsTab(userId, ["finance"], finance.actorId);
    expect(after.lines.find((line) => line.staff)?.staff?.state).toBe("undone");
    await expect(getCreditsTab(userId, ["moderator"], moderator.actorId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
