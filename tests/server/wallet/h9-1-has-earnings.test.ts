import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_OWNER, postTransaction } from "@/server/ledger";
import { earningsPresent, userHasEarnings } from "@/server/wallet/has-earnings";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const uid = () => new mongoose.Types.ObjectId().toString();

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

describe("H9.1 earnings rule", () => {
  it("counts anything waiting, asked for or paid out, and any withdrawal", () => {
    expect(earningsPresent({ available: 0, pending: 0, paid: 0 }, 0)).toBe(false);
    expect(earningsPresent({ available: 5, pending: 0, paid: 0 }, 0)).toBe(true);
    expect(earningsPresent({ available: 0, pending: 2, paid: 0 }, 0)).toBe(true);
    expect(earningsPresent({ available: 0, pending: 0, paid: 9 }, 0)).toBe(true);
    expect(earningsPresent({ available: 0, pending: 0, paid: 0 }, 1)).toBe(true);
  });

  it("reads the ledger and the withdrawals: nothing for a new account, true once earnings or a withdrawal exist", async () => {
    const owner = uid();
    expect(await userHasEarnings(owner)).toBe(false);
    await postTransaction({
      idempotencyKey: `fund-${owner}`,
      kind: "test_fund",
      refType: "test",
      refId: `ref-${owner}`,
      moves: [
        { account: "external", ownerKey: SYSTEM_OWNER, delta: -3 },
        { account: "vendor_earnings", ownerKey: owner, delta: 3 },
      ],
      requestId: "r",
    });
    expect(await userHasEarnings(owner)).toBe(true);
    const other = uid();
    expect(await userHasEarnings(other)).toBe(false);
    await Withdrawal.create({ userId: other, coins: 10, coinValueInr: 1, amountInr: 10, method: "upi", status: "requested" });
    expect(await userHasEarnings(other)).toBe(true);
  });
});
