import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requestWithdrawal, Withdrawal } from "@/server/wallet/withdrawals";
import { setPayoutProvider } from "@/server/wallet/payout-provider";
import { earn, ip, person, req, withKyc } from "./payout-helpers";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const failure = vi.hoisted(() => ({ holdFails: false }));

// Only the withdrawal hold can be made to fail. Every other ledger call runs for real.
vi.mock("@/server/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ledger")>();
  return {
    ...actual,
    postTransaction: (input: Parameters<typeof actual.postTransaction>[0]) => {
      if (failure.holdFails && input.kind === "withdrawal_hold") return Promise.reject(new Error("ledger unavailable"));
      return actual.postTransaction(input);
    },
  };
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CONTACT_ENCRYPTION_KEY = "give-back-encryption-key-0001";
  process.env.SESSION_SECRET = "session-secret";
  process.env.PAYOUT_PROVIDER = "mock";
  await connectMemoryMongo();
});
afterAll(async () => {
  delete process.env.CONTACT_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  delete process.env.PAYOUT_PROVIDER;
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  setPayoutProvider(null);
  failure.holdFails = false;
});

describe("withdrawal cooldown give-back", () => {
  it("gives the cooldown back when the ledger hold fails, so the next request is allowed", async () => {
    const vendor = await person("give-back@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 30);

    failure.holdFails = true;
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).rejects.toThrow("ledger unavailable");
    expect(await Withdrawal.countDocuments({ userId: vendor.id })).toBe(0);
    expect(await mongoose.connection.collection("auth_rate_limits").countDocuments({ key: `withdraw-cooldown:${vendor.id}` })).toBe(0);

    failure.holdFails = false;
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).resolves.toMatchObject({ status: "requested" });
  });

  it("keeps the cooldown after a request that went through, so a second one is still refused", async () => {
    const vendor = await person("give-back-kept@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 30);
    await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });

    // The cooldown refuses before any hold is attempted, so the hold failure never runs here.
    failure.holdFails = true;
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).rejects.toThrow(/3 days/);
    expect(await Withdrawal.countDocuments({ userId: vendor.id })).toBe(1);
  });
});
