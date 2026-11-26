import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { actionsFor, giveCreditsBack, markRechargeFailed, markRechargePaid } from "@/server/admin/order-actions";
import { undoEvent } from "@/server/admin/undo/core";
import { debitWallet, walletBalance } from "@/server/billing/ledger";
import { applyWebhook } from "@/server/billing/service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, CreditPack, Payment, User, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

let counter = 0;
const ctxOf = (roles: string[], n: number): AdminCtx => ({ actorId: `00000000000000000000005${n}`, email: `staff${n}@example.com`, roles, requestId: `req-${n}-${++counter}` });
const finance = () => ctxOf(["finance"], 1);
const admin = () => ctxOf(["admin"], 2);
const support = () => ctxOf(["support"], 3);

async function fixture(extra: Record<string, unknown> = {}) {
  const user = await User.create({ email: `u${++counter}@example.com`, passwordHash: "x", displayName: "Rohan", roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01") });
  const pack = await CreditPack.create({ credits: 500, bonus: 75, price: 4250, status: "active" });
  const doc = new Payment({ userId: user._id, orderId: pack._id, idempotencyKey: `idem-${++counter}`, amount: 4250, currency: "INR", status: "pending", method: "crypto", credits: 575, provider: "real", ...extra });
  await doc.save();
  return { user, pack, payment: doc, paymentId: String(doc._id), userId: String(user._id) };
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

describe("what staff may do", () => {
  it("offers Mark paid and Mark failed for a waiting live payment, Give back for a paid one, and nothing for a test payment", () => {
    expect(actionsFor({ status: "pending", provider: "real" }, 0)).toEqual({ markPaid: true, markFailed: true, refund: false });
    expect(actionsFor({ status: "failed", provider: "real" }, 0)).toEqual({ markPaid: true, markFailed: false, refund: false });
    expect(actionsFor({ status: "paid", provider: "real" }, 10)).toEqual({ markPaid: false, markFailed: false, refund: true });
    expect(actionsFor({ status: "paid", provider: "real" }, 0).refund).toBe(false);
    expect(actionsFor({ status: "pending", provider: "mock" }, 0)).toEqual({ markPaid: false, markFailed: false, refund: false });
  });
});

describe("mark paid", () => {
  it("adds the pack and its bonus once, audits it with the reason, and a repeat is refused without adding anything", async () => {
    const data = await fixture();
    const done = await markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Payment confirmed on the network at 23:58" });
    expect(done.credits).toBe(575);
    expect(await walletBalance(data.userId)).toBe(575);
    expect((await Payment.findById(data.paymentId).lean())?.status).toBe("paid");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "recharge.mark_paid", targetType: "user", targetId: data.userId, actorRole: "finance", reason: "Payment confirmed on the network at 23:58" });
    expect(row?.undo?.kind).toBe("wallet.adjust");
    expect(row?.undo?.data).toEqual({ delta: 575 });
    await expect(markRechargePaid(finance(), { paymentId: data.paymentId, reason: "again" })).rejects.toBeInstanceOf(ConflictError);
    expect(await walletBalance(data.userId)).toBe(575);
    expect(await AuditEvent.countDocuments({ action: "recharge.mark_paid" })).toBe(1);
  });

  it("two clicks at the same moment add the credits once and write one event", async () => {
    const data = await fixture();
    const results = await Promise.allSettled([
      markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Confirmed" }),
      markRechargePaid(admin(), { paymentId: data.paymentId, reason: "Confirmed" }),
      markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Confirmed" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await walletBalance(data.userId)).toBe(575);
    expect(await WalletEntry.countDocuments({ userId: data.user._id })).toBe(2);
    expect(await AuditEvent.countDocuments({ action: "recharge.mark_paid" })).toBe(1);
  });

  it("a real payment confirmation that arrives afterwards adds nothing twice", async () => {
    const data = await fixture();
    await markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Confirmed" });
    await applyWebhook({ eventId: "evt-real-1", idempotencyKey: data.payment.idempotencyKey, status: "paid" }, "req-webhook");
    expect(await walletBalance(data.userId)).toBe(575);
  });

  it("can also finish a payment that was marked failed by mistake", async () => {
    const data = await fixture();
    await markRechargeFailed(finance(), { paymentId: data.paymentId, reason: "Looked unpaid" });
    const done = await markRechargePaid(finance(), { paymentId: data.paymentId, reason: "It was paid after all" });
    expect(done.credits).toBe(575);
    expect(await walletBalance(data.userId)).toBe(575);
  });

  it("needs finance or an admin, a reason without blocked words, and refuses test payments and unknown ids", async () => {
    const data = await fixture();
    await expect(markRechargePaid(support(), { paymentId: data.paymentId, reason: "ok" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
    await expect(markRechargePaid(finance(), { paymentId: data.paymentId, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(markRechargePaid(finance(), { paymentId: data.paymentId, reason: "a blockedword" })).rejects.toBeInstanceOf(ValidationError);
    const test = await fixture({ provider: "mock" });
    await expect(markRechargePaid(finance(), { paymentId: test.paymentId, reason: "ok" })).rejects.toBeInstanceOf(ConflictError);
    await expect(markRechargePaid(finance(), { paymentId: "0123456789abcdef01234567", reason: "ok" })).rejects.toBeInstanceOf(NotFoundError);
    expect(await walletBalance(data.userId)).toBe(0);
    expect((await Payment.findById(data.paymentId).lean())?.status).toBe("pending");
  });

  it("Undo takes the credits back while unspent and is refused once they are spent", async () => {
    const data = await fixture();
    const done = await markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Confirmed" });
    expect((await undoEvent(finance(), done.eventId)).ok).toBe(true);
    expect(await walletBalance(data.userId)).toBe(0);

    const other = await fixture();
    const second = await markRechargePaid(finance(), { paymentId: other.paymentId, reason: "Confirmed" });
    await debitWallet({ userId: other.userId, amount: 100, refType: "listing_fee", refId: "ad:1", requestId: "r" });
    expect(await undoEvent(finance(), second.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    expect(await walletBalance(other.userId)).toBe(475);
  });
});

describe("mark failed", () => {
  it("fails only a waiting recharge, moves no credits, and cannot run twice", async () => {
    const data = await fixture();
    const done = await markRechargeFailed(admin(), { paymentId: data.paymentId, reason: "The customer cancelled" });
    expect((await Payment.findById(data.paymentId).lean())?.status).toBe("failed");
    expect(await walletBalance(data.userId)).toBe(0);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "recharge.mark_failed", reason: "The customer cancelled" });
    await expect(markRechargeFailed(admin(), { paymentId: data.paymentId, reason: "again" })).rejects.toBeInstanceOf(ConflictError);
    const paid = await fixture({ status: "paid" });
    await expect(markRechargeFailed(finance(), { paymentId: paid.paymentId, reason: "no" })).rejects.toBeInstanceOf(ConflictError);
    const waiting = await fixture();
    await expect(markRechargeFailed(support(), { paymentId: waiting.paymentId, reason: "no" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await Payment.findById(waiting.paymentId).lean())?.status).toBe("pending");
  });
});

describe("give credits back", () => {
  async function paid() {
    const data = await fixture();
    await markRechargePaid(finance(), { paymentId: data.paymentId, reason: "Confirmed" });
    return data;
  }

  it("gives credits back up to what the recharge credited, writes one ledger line, and the change is locked: no undo", async () => {
    const data = await paid();
    const done = await giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 100, reason: "Goodwill" });
    expect(done.credits).toBe(100);
    expect(done.undoUntil).toBeNull();
    expect(await walletBalance(data.userId)).toBe(675);
    expect(await WalletEntry.countDocuments({ refType: "refund", userId: data.user._id })).toBe(1);
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "recharge.refund", lock: "money_sent", reason: "Goodwill" });
    expect(row?.undo).toBeUndefined();
    expect(await undoEvent(finance(), done.eventId)).toMatchObject({ ok: false, reason: "locked" });
    expect(await walletBalance(data.userId)).toBe(675);
  });

  it("the same refund sent twice, or two clicks together, gives credits back once", async () => {
    const data = await paid();
    const results = await Promise.allSettled([
      giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 50, reason: "Goodwill" }),
      giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 50, reason: "Goodwill" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 50, reason: "Goodwill" })).rejects.toBeInstanceOf(ConflictError);
    expect(await walletBalance(data.userId)).toBe(625);
    expect(await WalletEntry.countDocuments({ refType: "refund" })).toBe(1);
  });

  it("eight clicks together still give credits back once", async () => {
    const data = await paid();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 50, reason: "Goodwill" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await walletBalance(data.userId)).toBe(625);
    expect(await WalletEntry.countDocuments({ refType: "refund" })).toBe(1);
  });

  it("never gives back more than was credited, in one go or across several", async () => {
    const data = await paid();
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 576, reason: "Too much" })).rejects.toBeInstanceOf(ConflictError);
    await giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 500, reason: "First part" });
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 76, reason: "Second part" })).rejects.toThrow(/At most 75/);
    await giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 75, reason: "Rest" });
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 1, reason: "Extra" })).rejects.toThrow(/already given back/);
    expect(await walletBalance(data.userId)).toBe(1150);
  });

  it("needs finance or an admin and a reason, and refuses an unpaid or test payment and a bad amount", async () => {
    const data = await paid();
    await expect(giveCreditsBack(support(), { paymentId: data.paymentId, amount: 5, reason: "ok" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 5, reason: " " })).rejects.toBeInstanceOf(ValidationError);
    await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount: 5, reason: "blockedword" })).rejects.toBeInstanceOf(ValidationError);
    for (const amount of [0, -3, 1.5, Number.NaN, "abc"]) await expect(giveCreditsBack(finance(), { paymentId: data.paymentId, amount, reason: "ok" })).rejects.toBeInstanceOf(ValidationError);
    const waiting = await fixture();
    await expect(giveCreditsBack(finance(), { paymentId: waiting.paymentId, amount: 5, reason: "ok" })).rejects.toBeInstanceOf(ConflictError);
    const test = await fixture({ provider: "mock", status: "paid" });
    await expect(giveCreditsBack(finance(), { paymentId: test.paymentId, amount: 5, reason: "ok" })).rejects.toBeInstanceOf(ConflictError);
    expect(await WalletEntry.countDocuments({ refType: "refund" })).toBe(0);
  });
});
