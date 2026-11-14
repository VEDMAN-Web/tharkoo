import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import {
  LEDGER_ACCOUNTS,
  LedgerTransaction,
  SYSTEM_OWNER,
  accountBalance,
  assertBalanced,
  postTransaction,
  trialBalance,
  type LedgerAccount,
  type LedgerMove,
} from "@/server/ledger";
import { holdInEscrow, refundEscrow, registerSpendGuard, releaseEscrow } from "@/server/wallet";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const uid = () => new mongoose.Types.ObjectId().toString();
const req = "req-ledger";

/** Small seeded generator so a failing run can be repeated. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

let counter = 0;
const key = (prefix: string) => `${prefix}-${(counter += 1)}`;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function fund(account: LedgerAccount, owner: string, coins: number) {
  return postTransaction({
    idempotencyKey: key("fund"),
    kind: "test_fund",
    refType: "test",
    refId: key("fund-ref"),
    moves: [
      { account: "external", ownerKey: SYSTEM_OWNER, delta: -coins },
      { account, ownerKey: owner, delta: coins },
    ],
    requestId: req,
  });
}

describe("ledger", () => {
  it("refuses a transaction that does not balance or is malformed", () => {
    expect(() => assertBalanced([{ account: "escrow", ownerKey: "a", delta: 5 }])).toThrow();
    expect(() =>
      assertBalanced([
        { account: "escrow", ownerKey: "a", delta: 5 },
        { account: "vendor_earnings", ownerKey: "b", delta: -4 },
      ]),
    ).toThrow();
    expect(() =>
      assertBalanced([
        { account: "escrow", ownerKey: "a", delta: 1.5 },
        { account: "vendor_earnings", ownerKey: "b", delta: -1.5 },
      ]),
    ).toThrow();
    expect(() =>
      assertBalanced([
        { account: "escrow", ownerKey: "a", delta: 0 },
        { account: "vendor_earnings", ownerKey: "b", delta: 0 },
      ]),
    ).toThrow();
  });

  it("cannot be edited or deleted after posting", async () => {
    await fund("vendor_earnings", uid(), 3);
    await expect(LedgerTransaction.updateMany({}, { $set: { kind: "x" } })).rejects.toThrow(/append-only/);
    await expect(LedgerTransaction.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it("property: any run of random moves keeps the books at zero and no guarded account negative", async () => {
    const random = prng(20261114);
    const owners = [uid(), uid(), uid()];
    const guarded: LedgerAccount[] = ["escrow", "vendor_earnings", "payout_pending"];
    for (const owner of owners) await fund("vendor_earnings", owner, 20);
    for (let step = 0; step < 60; step += 1) {
      const from = guarded[Math.floor(random() * guarded.length)];
      const to = LEDGER_ACCOUNTS.filter((name) => name !== "user_wallet" && name !== "external")[Math.floor(random() * 5)];
      const coins = 1 + Math.floor(random() * 12);
      const moves: LedgerMove[] = [
        { account: from, ownerKey: owners[Math.floor(random() * 3)], delta: -coins },
        { account: to, ownerKey: owners[Math.floor(random() * 3)], delta: coins },
      ];
      try {
        await postTransaction({ idempotencyKey: key("prop"), kind: "prop", refType: "test", refId: key("p"), moves, requestId: req });
      } catch (error) {
        expect((error as Error).message).toMatch(/Insufficient|Invalid request/);
      }
      expect(await trialBalance()).toBe(0);
    }
    for (const owner of owners) {
      for (const account of guarded) expect(await accountBalance(account, owner)).toBeGreaterThanOrEqual(0);
    }
  });

  it("double spend: two concurrent withdrawals of the same coins let only one through", async () => {
    const vendor = uid();
    await fund("vendor_earnings", vendor, 5);
    const attempt = (id: string) =>
      postTransaction({
        idempotencyKey: `withdraw:${id}`,
        kind: "withdraw",
        refType: "withdrawal",
        refId: id,
        moves: [
          { account: "vendor_earnings", ownerKey: vendor, delta: -5 },
          { account: "payout_pending", ownerKey: vendor, delta: 5 },
        ],
        requestId: req,
      });
    const results = await Promise.allSettled([attempt("a"), attempt("b"), attempt("c"), attempt("d")]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await accountBalance("vendor_earnings", vendor)).toBe(0);
    expect(await accountBalance("payout_pending", vendor)).toBe(5);
    expect(await trialBalance()).toBe(0);
  });

  it("double spend on the user wallet: concurrent holds cannot overdraw", async () => {
    const user = uid();
    const vendor = uid();
    await creditWallet({ userId: user, amount: 5, refType: "test", refId: "seed", requestId: req });
    const hold = (id: string) => holdInEscrow({ userId: user, vendorId: vendor, coins: 5, bookingId: id, requestId: req });
    const results = await Promise.allSettled([hold("b1"), hold("b2"), hold("b3")]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(await walletBalance(user)).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("a repeated key posts once", async () => {
    const vendor = uid();
    const first = await fund("vendor_earnings", vendor, 4);
    const input = {
      idempotencyKey: "same-key",
      kind: "x",
      refType: "t",
      refId: "r",
      moves: [
        { account: "vendor_earnings" as const, ownerKey: vendor, delta: -2 },
        { account: "paid_out" as const, ownerKey: vendor, delta: 2 },
      ],
      requestId: req,
    };
    const one = await postTransaction(input);
    const two = await postTransaction(input);
    expect(first.created).toBe(true);
    expect(one.created).toBe(true);
    expect(two.created).toBe(false);
    expect(await accountBalance("vendor_earnings", vendor)).toBe(2);
  });
});

describe("escrow", () => {
  it("refunds the whole hold when a tour is declined", async () => {
    const user = uid();
    const vendor = uid();
    await creditWallet({ userId: user, amount: 10, refType: "test", refId: "seed", requestId: req });
    await holdInEscrow({ userId: user, vendorId: vendor, coins: 4, bookingId: "tour-1", requestId: req });
    expect(await walletBalance(user)).toBe(6);
    await refundEscrow({ userId: user, vendorId: vendor, coins: 4, bookingId: "tour-1", requestId: req });
    await refundEscrow({ userId: user, vendorId: vendor, coins: 4, bookingId: "tour-1", requestId: req });
    expect(await walletBalance(user)).toBe(10);
    expect(await accountBalance("escrow", "booking:tour-1")).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("release moves the vendor share to earnings and the fee to platform revenue", async () => {
    const user = uid();
    const vendor = uid();
    await creditWallet({ userId: user, amount: 10, refType: "test", refId: "seed", requestId: req });
    await holdInEscrow({ userId: user, vendorId: vendor, coins: 10, bookingId: "tour-2", requestId: req });
    await releaseEscrow({ userId: user, vendorId: vendor, coins: 10, bookingId: "tour-2", platformFee: 1, requestId: req });
    expect(await accountBalance("vendor_earnings", vendor)).toBe(9);
    expect(await accountBalance("platform_revenue", SYSTEM_OWNER)).toBe(1);
    expect(await trialBalance()).toBe(0);
  });

  it("a registered spend guard (the people-category hook) can refuse a hold and leaves the wallet untouched", async () => {
    const user = uid();
    await creditWallet({ userId: user, amount: 3, refType: "test", refId: "seed", requestId: req });
    const off = registerSpendGuard(() => "Not allowed for this category");
    await expect(
      holdInEscrow({ userId: user, vendorId: uid(), coins: 1, bookingId: "g1", requestId: req }),
    ).rejects.toThrow(/Not allowed/);
    off();
    expect(await walletBalance(user)).toBe(3);
    await holdInEscrow({ userId: user, vendorId: uid(), coins: 1, bookingId: "g2", requestId: req });
    expect(await walletBalance(user)).toBe(2);
  });
});
