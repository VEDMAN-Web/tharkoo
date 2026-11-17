import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { redeemCoupon } from "@/server/billing/coupons";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { refundPayment, refundableCredits, refundableFromLines } from "@/server/billing/service";
import { ConflictError, PaymentRequiredError } from "@/server/http";
import { AuditEvent, Coupon, CreditPack, Payment, User, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H7.152: the wallet is written once per key, and a check and its write cannot be separated by another request. */

let counter = 0;

async function person() {
  return User.create({ email: `w${++counter}@example.com`, passwordHash: "x", displayName: "Rohan", roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01") });
}

/** A paid recharge that credited `credits` (and, optionally, a bonus) to its owner. */
async function paidRecharge(credits: number, bonus = 0) {
  const user = await person();
  const pack = await CreditPack.create({ credits, bonus, price: credits * 10, status: "active" });
  const payment = await Payment.create({ userId: user._id, orderId: pack._id, idempotencyKey: `idem-${++counter}`, amount: credits * 10, currency: "INR", status: "paid", method: "card", credits: credits + bonus, provider: "real" });
  const userId = String(user._id);
  const paymentId = String(payment._id);
  await creditWallet({ userId, amount: credits, refType: "pack", refId: paymentId, requestId: "setup", once: true });
  if (bonus) await creditWallet({ userId, amount: bonus, refType: "pack_bonus", refId: `${paymentId}:bonus`, requestId: "setup", once: true });
  return { userId, paymentId, payment };
}

const refund = (data: { userId: string; paymentId: string }, amount: number, reason: string) =>
  refundPayment({ actorId: "000000000000000000000099", roles: ["finance"], paymentId: data.paymentId, amount, reason, requestId: `req-${reason}` });

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await WalletEntry.init();
  await Coupon.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("two different refunds of one payment", () => {
  it("never give back more than the payment credited, however they arrive", async () => {
    const data = await paidRecharge(100);
    const results = await Promise.allSettled([refund(data, 60, "first"), refund(data, 60, "second")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(ConflictError);
    expect(String(refused.reason.message)).toContain("exceeds");
    expect(await refundableCredits(data.payment)).toBe(40);
    expect(await walletBalance(data.userId)).toBe(160);
  });

  it("with many at once, the ones that fit are written and the total stays within the credited amount", async () => {
    const data = await paidRecharge(100, 20);
    const results = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7, 8].map((n) => refund(data, 30, `reason ${n}`)));
    const done = results.filter((result) => result.status === "fulfilled").length;
    expect(done).toBe(4);
    expect(await refundableCredits(data.payment)).toBe(0);
    const lines = await WalletEntry.find({ userId: data.userId, refType: "refund" }).lean();
    expect(lines).toHaveLength(4);
    expect(lines.reduce((sum, line) => sum + line.delta, 0)).toBe(120);
    expect(await walletBalance(data.userId)).toBe(240);
  });

  it("the same refund sent twice together is written once, and a later one is checked against what is left", async () => {
    const data = await paidRecharge(100);
    const same = await Promise.allSettled([refund(data, 70, "same"), refund(data, 70, "same")]);
    expect(same.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await WalletEntry.countDocuments({ userId: data.userId, refType: "refund" })).toBe(1);
    await expect(refund(data, 31, "later")).rejects.toBeInstanceOf(ConflictError);
    await expect(refund(data, 30, "later")).resolves.toMatchObject({ balance: 200 });
    await expect(refund(data, 1, "extra")).rejects.toBeInstanceOf(ConflictError);
  });

  it("the rule is one pure function of the lines: credited minus refunded, never below zero", () => {
    const lines = [
      { delta: 100, refType: "pack", refId: "p1" },
      { delta: 10, refType: "pack_bonus", refId: "p1:bonus" },
      { delta: 5, refType: "coupon", refId: "p1:coupon" },
      { delta: 40, refType: "refund", refId: "p1#40#abc" },
      { delta: 50, refType: "refund", refId: "p2#50#abc" },
      { delta: 999, refType: "pack", refId: "p2" },
    ];
    expect(refundableFromLines(lines, "p1")).toBe(75);
    expect(refundableFromLines([{ delta: 10, refType: "refund", refId: "p1#10#x" }], "p1")).toBe(0);
  });
});

describe("wallet lines with a key are written once", () => {
  it("credits sent together with one key add one line", async () => {
    const user = await person();
    const userId = String(user._id);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => creditWallet({ userId, amount: 25, refType: "pack", refId: "same-order", requestId: "r", once: true })));
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await walletBalance(userId)).toBe(25);
    expect(await WalletEntry.countDocuments({ userId })).toBe(1);
  });

  it("debits sent together with one key take the amount once, and different keys cannot take more than the balance", async () => {
    const user = await person();
    const userId = String(user._id);
    await creditWallet({ userId, amount: 100, refType: "pack", refId: "fund", requestId: "r", once: true });
    const same = await Promise.all([1, 2, 3].map(() => debitWallet({ userId, amount: 30, refType: "promotion", refId: "one-order", requestId: "r", once: true })));
    expect(same.filter((result) => result.created)).toHaveLength(1);
    expect(await walletBalance(userId)).toBe(70);
    const many = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => debitWallet({ userId, amount: 30, refType: "promotion", refId: `order-${n}`, requestId: "r", once: true })));
    expect(many.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    for (const result of many) if (result.status === "rejected") expect(result.reason).toBeInstanceOf(PaymentRequiredError);
    expect(await walletBalance(userId)).toBe(10);
  });

  it("a guard runs on the lines of the write itself and refuses it with its own error", async () => {
    const user = await person();
    const userId = String(user._id);
    await creditWallet({ userId, amount: 10, refType: "pack", refId: "g1", requestId: "r", once: true });
    await expect(
      creditWallet({
        userId,
        amount: 5,
        refType: "x",
        refId: "g2",
        requestId: "r",
        once: true,
        guard: (lines) => {
          if (lines.length >= 1) throw new ConflictError("Not allowed now");
        },
      }),
    ).rejects.toThrow("Not allowed now");
    expect(await walletBalance(userId)).toBe(10);
    // A repeat of a line that is already written is answered without running the guard.
    await expect(
      creditWallet({ userId, amount: 10, refType: "pack", refId: "g1", requestId: "r", once: true, guard: () => { throw new ConflictError("never"); } }),
    ).resolves.toMatchObject({ created: false });
  });
});

describe("a coupon with a limit for each person", () => {
  it("gives the credits once when the same person redeems it several times at the same moment", async () => {
    const user = await person();
    const userId = String(user._id);
    await Coupon.create({ code: "GIFT50", label: "GIFT50", kind: "credits", credits: 50, status: "active", perUserLimit: 1 });
    const results = await Promise.allSettled([1, 2, 3, 4].map((n) => redeemCoupon(userId, "gift50", `req-${n}`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    expect(await walletBalance(userId)).toBe(50);
    expect(await WalletEntry.countDocuments({ userId, refType: "coupon" })).toBe(1);
    expect((await Coupon.findOne({ code: "GIFT50" }).lean())?.redeemedCount).toBe(1);
  });

  it("lets a person use it up to the limit and no further", async () => {
    const user = await person();
    const userId = String(user._id);
    await Coupon.create({ code: "TWICE", label: "TWICE", kind: "credits", credits: 10, status: "active", perUserLimit: 2 });
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => redeemCoupon(userId, "TWICE", `req-${n}`)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await walletBalance(userId)).toBe(20);
    expect((await Coupon.findOne({ code: "TWICE" }).lean())?.redeemedCount).toBe(2);
  });
});
