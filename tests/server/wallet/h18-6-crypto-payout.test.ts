import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accountBalance, postTransaction } from "@/server/ledger";
import { payoutKycSchema, submitPayoutKyc } from "@/server/wallet/payout-kyc";
import { setPayoutProvider, usdtForInr } from "@/server/wallet/payout-provider";
import { approveWithdrawal, requestWithdrawal, Withdrawal } from "@/server/wallet/withdrawals";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const TRON = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const req = "req-h18-6";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CONTACT_ENCRYPTION_KEY = "test-encryption-key-32-characters!!";
  process.env.PASSIMPAY_PLATFORM_ID = "123";
  process.env.PASSIMPAY_API_KEY = "test-key";
  process.env.USDT_INR_RATE = "88";
  await connectMemoryMongo();
});
afterAll(async () => {
  for (const key of ["CONTACT_ENCRYPTION_KEY", "PASSIMPAY_PLATFORM_ID", "PASSIMPAY_API_KEY", "USDT_INR_RATE"]) delete process.env[key];
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  setPayoutProvider(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function vendorWithEarnings(coins: number) {
  const vendorId = new mongoose.Types.ObjectId().toString();
  await postTransaction({
    idempotencyKey: `earn:${vendorId}`,
    kind: "escrow_release",
    refType: "booking",
    refId: vendorId,
    moves: [
      { account: "external", ownerKey: "system", delta: -coins },
      { account: "vendor_earnings", ownerKey: vendorId, delta: coins },
    ],
    requestId: req,
    actorType: "system",
  });
  await submitPayoutKyc({
    userId: vendorId,
    values: payoutKycSchema.parse({ method: "crypto", legalName: "Asha Rao", pan: "abcde1234f", network: "TRC20", walletAddress: TRON }),
    requestId: req,
  });
  return vendorId;
}

function fakeWithdraw(response: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, ...JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(response));
    }),
  );
  return calls;
}

const staff = { actorId: new mongoose.Types.ObjectId().toString(), roles: ["finance"], requestId: req };

describe("H18.6 crypto payouts through PassimPay", () => {
  it("accepts a TRC20 or BEP20 wallet and refuses a wrong address", () => {
    expect(payoutKycSchema.safeParse({ method: "crypto", legalName: "Asha Rao", pan: "ABCDE1234F", network: "TRC20", walletAddress: TRON }).success).toBe(true);
    expect(payoutKycSchema.safeParse({ method: "crypto", legalName: "Asha Rao", pan: "ABCDE1234F", network: "BEP20", walletAddress: `0x${"a".repeat(40)}` }).success).toBe(true);
    expect(payoutKycSchema.safeParse({ method: "crypto", legalName: "Asha Rao", pan: "ABCDE1234F", network: "TRC20", walletAddress: `0x${"a".repeat(40)}` }).success).toBe(false);
  });

  it("converts rupees to USDT rounded down", () => {
    expect(usdtForInr(1000, 88)).toBe("11.36");
    expect(usdtForInr(8800, 88)).toBe("100.00");
  });

  it("approving sends USDT to the vendor's wallet and marks the payout paid", async () => {
    const vendorId = await vendorWithEarnings(100);
    const { id } = await requestWithdrawal({ userId: vendorId, coins: 50, requestId: req }).then((row) => ({ id: String((row as { id?: string }).id ?? (row as { _id?: unknown })._id) }));
    const calls = fakeWithdraw({ result: 1, transactionId: "tx-abc" });
    const result = await approveWithdrawal({ ...staff, id });
    expect(result.status).toBe("paid");
    expect(calls[0]).toMatchObject({ url: "https://api.passimpay.io/v2/withdraw", paymentId: 71, addressTo: TRON, orderId: id });
    const row = await Withdrawal.findById(id).lean();
    expect(row).toMatchObject({ status: "paid", reference: "passimpay:tx-abc" });
    expect(calls[0].amount).toBe(usdtForInr(row!.amountInr, 88));
    expect(await accountBalance("paid_out", vendorId)).toBe(50);
  });

  it("sends exactly the USDT amount the admin entered", async () => {
    const vendorId = await vendorWithEarnings(100);
    const row = await requestWithdrawal({ userId: vendorId, coins: 50, requestId: req });
    const id = String((row as { id?: string }).id ?? (row as { _id?: unknown })._id);
    const calls = fakeWithdraw({ result: 1, transactionId: "tx-admin" });
    expect((await approveWithdrawal({ ...staff, id, usdtAmount: "55.25" })).status).toBe("paid");
    expect(calls[0].amount).toBe("55.25");
    expect((await Withdrawal.findById(id).lean())?.usdtAmount).toBe("55.25");
  });

  it("a PassimPay refusal fails the payout and gives the coins back", async () => {
    const vendorId = await vendorWithEarnings(100);
    const row = await requestWithdrawal({ userId: vendorId, coins: 50, requestId: req });
    const id = String((row as { id?: string }).id ?? (row as { _id?: unknown })._id);
    fakeWithdraw({ result: 0, message: "Insufficient balance" });
    expect((await approveWithdrawal({ ...staff, id })).status).toBe("failed");
    expect(await accountBalance("vendor_earnings", vendorId)).toBe(100);
  });
});
