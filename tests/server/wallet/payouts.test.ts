import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as walletPost, PUT as walletPut, GET as walletGet } from "@/app/api/wallet/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { accountBalance, postTransaction, trialBalance } from "@/server/ledger";
import { ConflictError, ForbiddenError, PaymentRequiredError, ValidationError } from "@/server/http";
import { Session, User } from "@/server/models";
import { FinanceSettings } from "@/server/wallet/models";
import { decryptField, encryptField, maskTail, maskUpi } from "@/server/wallet/payout-crypto";
import { PayoutKyc, getPayoutKyc, payoutKycSchema, submitPayoutKyc } from "@/server/wallet/payout-kyc";
import { setPayoutProvider } from "@/server/wallet/payout-provider";
import {
  approveWithdrawal,
  listPayoutsForStaff,
  markWithdrawalFailed,
  markWithdrawalPaid,
  payoutSummary,
  rejectWithdrawal,
  requestWithdrawal,
  Withdrawal,
} from "@/server/wallet/withdrawals";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const ENCRYPTION_KEY = "payout-test-encryption-key-0001";
const req = "req-payouts";
const ip = "203.0.113.7";

const uid = () => new mongoose.Types.ObjectId().toString();

async function person(email: string, roles = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Vendor",
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: String(user._id), cookie: `sid=${encodeURIComponent(token)}` };
}

/** Puts coins into a vendor's earnings the way a completed booking does, through the ledger. */
async function earn(vendorId: string, coins: number) {
  await postTransaction({
    idempotencyKey: `test-earn:${uid()}`,
    kind: "escrow_release",
    refType: "booking",
    refId: uid(),
    moves: [
      { account: "external", ownerKey: "system", delta: -coins },
      { account: "vendor_earnings", ownerKey: vendorId, delta: coins },
    ],
    requestId: req,
    actorType: "system",
  });
}

const bankDetails = {
  method: "bank" as const,
  legalName: "Ada Lovelace",
  pan: "abcde1234f",
  accountNumber: "123456789012",
  ifsc: "hdfc0001234",
};

async function withKyc(vendorId: string) {
  return submitPayoutKyc({ userId: vendorId, values: payoutKycSchema.parse(bankDetails), requestId: req, ip });
}

function call(method: "GET" | "POST" | "PUT", path: string, cookie: string, body?: unknown) {
  const headers = new Headers({ origin, cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return method === "GET" ? walletGet(request) : method === "PUT" ? walletPut(request) : walletPost(request);
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CONTACT_ENCRYPTION_KEY = ENCRYPTION_KEY;
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
});
afterEach(() => {
  setPayoutProvider(null);
});

describe("payout KYC", () => {
  it("stores only encrypted values and returns them masked", async () => {
    const vendor = await person("kyc-mask@example.com");
    const shown = await withKyc(vendor.id);
    const json = JSON.stringify(shown);
    expect(json).not.toContain("ABCDE1234F");
    expect(json).not.toContain("123456789012");
    expect(shown.pan).toBe(`${"*".repeat(6)}234F`);
    expect(shown.accountNumber).toBe("********9012");
    expect(shown.legalName).toBe("Ada Lovelace");

    const raw = await PayoutKyc.collection.findOne({});
    const stored = JSON.stringify(raw);
    expect(stored).not.toContain("ABCDE1234F");
    expect(stored).not.toContain("123456789012");
    expect(stored).not.toContain("Ada Lovelace");
    expect(stored).not.toContain("HDFC0001234");
  });

  it("refuses a second submit so the payout account cannot be swapped", async () => {
    const vendor = await person("kyc-once@example.com");
    await withKyc(vendor.id);
    await expect(withKyc(vendor.id)).rejects.toBeInstanceOf(ConflictError);
    expect(await PayoutKyc.countDocuments({ userId: vendor.id })).toBe(1);
  });

  it("masks a UPI ID but keeps the provider so the vendor recognises it", async () => {
    const vendor = await person("kyc-upi@example.com");
    const shown = await submitPayoutKyc({
      userId: vendor.id,
      values: payoutKycSchema.parse({ method: "upi", legalName: "Ada Lovelace", pan: "ABCDE1234F", upiId: "adalovelace@okhdfc" }),
      requestId: req,
      ip,
    });
    expect(shown.upiId).toBe(`ad${"*".repeat(9)}@okhdfc`);
    expect(JSON.stringify(await getPayoutKyc(vendor.id))).not.toContain("adalovelace");
  });

  it("rejects a malformed PAN through the route with field errors", async () => {
    const vendor = await person("kyc-bad@example.com");
    const response = await call("PUT", "/api/wallet/payouts/kyc", vendor.cookie, { ...bankDetails, pan: "NOTAPAN" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { fields?: Record<string, string[]> } };
    expect(body.error.fields?.pan).toBeDefined();
  });

  it("encrypts with the key from CONTACT_ENCRYPTION_KEY and round-trips", () => {
    const sealed = encryptField("123456789012");
    expect(sealed).not.toContain("123456789012");
    expect(decryptField(sealed)).toBe("123456789012");
    expect(encryptField("same")).not.toBe(encryptField("same"));
    delete process.env.CONTACT_ENCRYPTION_KEY;
    try {
      expect(() => encryptField("x")).toThrow(/CONTACT_ENCRYPTION_KEY/);
    } finally {
      process.env.CONTACT_ENCRYPTION_KEY = ENCRYPTION_KEY;
    }
  });

  it("masks helpers keep only the tail", () => {
    expect(maskTail("123456789012")).toBe("********9012");
    expect(maskUpi("ab@okaxis")).toBe("ab*@okaxis");
  });
});

describe("withdrawal requests", () => {
  it("refuses below the admin minimum (default 5 coins)", async () => {
    const vendor = await person("min-default@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 50);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 4, requestId: req, ip })).rejects.toBeInstanceOf(ValidationError);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).resolves.toMatchObject({ status: "requested" });
  });

  it("uses an admin-set minimum when one is saved", async () => {
    await FinanceSettings.updateOne({ key: "finance" }, { $set: { minWithdrawCoins: 20 } }, { upsert: true });
    const vendor = await person("min-admin@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 50);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 19, requestId: req, ip })).rejects.toBeInstanceOf(ValidationError);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 20, requestId: req, ip })).resolves.toBeDefined();
  });

  it("needs payout details first", async () => {
    const vendor = await person("no-kyc@example.com");
    await earn(vendor.id, 10);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses more than the vendor earned", async () => {
    const vendor = await person("funds@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 6);
    await expect(requestWithdrawal({ userId: vendor.id, coins: 7, requestId: req, ip })).rejects.toBeInstanceOf(PaymentRequiredError);
    expect(await Withdrawal.countDocuments({ userId: vendor.id })).toBe(0);
  });

  it("allows one request per cooldown (default 3 days), and again once it has passed", async () => {
    const vendor = await person("cooldown@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 30);
    await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });

    const tooSoon = requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
    await expect(tooSoon).rejects.toBeInstanceOf(ConflictError);
    await expect(tooSoon).rejects.toThrow(/3 days/);

    // Move the cooldown window into the past, as if three days had passed.
    await mongoose.connection.collection("auth_rate_limits").updateOne(
      { key: `withdraw-cooldown:${vendor.id}` },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await expect(requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip })).resolves.toMatchObject({ status: "requested" });
  });

  it("shows the next allowed date in the vendor summary", async () => {
    const vendor = await person("summary@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 30);
    await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
    const summary = await payoutSummary(vendor.id);
    expect(summary.availableCoins).toBe(25);
    expect(summary.pendingCoins).toBe(5);
    expect(summary.nextWithdrawalAt).not.toBeNull();
    expect(summary.kyc?.accountNumber).toBe("********9012");
  });
});

describe("reject, fail and pay", () => {
  async function requested(email: string, coins = 10) {
    const vendor = await person(email);
    await withKyc(vendor.id);
    await earn(vendor.id, 100);
    const row = await requestWithdrawal({ userId: vendor.id, coins, requestId: req, ip });
    return { vendor, id: row.id };
  }

  it("rejecting returns the coins to vendor earnings", async () => {
    const { vendor, id } = await requested("reject@example.com");
    expect(await accountBalance("payout_pending", vendor.id)).toBe(10);
    await rejectWithdrawal({ id, actorId: uid(), roles: ["finance"], reason: "Bank details unclear", requestId: req });
    expect(await accountBalance("vendor_earnings", vendor.id)).toBe(100);
    expect(await accountBalance("payout_pending", vendor.id)).toBe(0);
    expect((await Withdrawal.findById(id).lean())?.status).toBe("rejected");
  });

  it("a rejected payout cannot be rejected or approved again", async () => {
    const { id } = await requested("reject-twice@example.com");
    await rejectWithdrawal({ id, actorId: uid(), roles: ["finance"], reason: "Bank details unclear", requestId: req });
    await expect(rejectWithdrawal({ id, actorId: uid(), roles: ["finance"], reason: "again ok", requestId: req })).rejects.toBeInstanceOf(ConflictError);
    await expect(approveWithdrawal({ id, actorId: uid(), roles: ["finance"], requestId: req })).rejects.toBeInstanceOf(ConflictError);
  });

  it("a provider refusal returns the coins and marks the payout failed", async () => {
    setPayoutProvider({
      name: "mock",
      initiate: async () => ({ ok: false, reason: "Beneficiary account closed" }),
    });
    const { vendor, id } = await requested("refused@example.com");
    const result = await approveWithdrawal({ id, actorId: uid(), roles: ["finance"], requestId: req });
    expect(result.status).toBe("failed");
    expect(await accountBalance("vendor_earnings", vendor.id)).toBe(100);
    expect(await accountBalance("payout_pending", vendor.id)).toBe(0);
    expect((await Withdrawal.findById(id).lean())?.reason).toBe("Beneficiary account closed");
  });

  it("a provider that throws sends nothing, so the payout stays requested", async () => {
    setPayoutProvider({
      name: "mock",
      initiate: async () => {
        throw new Error("network down");
      },
    });
    const { vendor, id } = await requested("throws@example.com");
    await expect(approveWithdrawal({ id, actorId: uid(), roles: ["finance"], requestId: req })).rejects.toThrow("network down");
    expect((await Withdrawal.findById(id).lean())?.status).toBe("requested");
    expect(await accountBalance("payout_pending", vendor.id)).toBe(10);
  });

  it("approved then failed at the bank returns the coins", async () => {
    const { vendor, id } = await requested("bank-fail@example.com");
    await approveWithdrawal({ id, actorId: uid(), roles: ["finance"], requestId: req });
    const row = await Withdrawal.findById(id).lean();
    expect(row?.status).toBe("approved");
    expect(row?.providerRef).toMatch(/^mock_payout_/);
    await markWithdrawalFailed({ id, actorId: uid(), roles: ["finance"], reason: "Returned by bank", requestId: req });
    expect(await accountBalance("vendor_earnings", vendor.id)).toBe(100);
    expect((await Withdrawal.findById(id).lean())?.status).toBe("failed");
  });

  it("approved then paid moves the coins out with the reference", async () => {
    const { vendor, id } = await requested("paid@example.com");
    await approveWithdrawal({ id, actorId: uid(), roles: ["finance"], requestId: req });
    await markWithdrawalPaid({ id, actorId: uid(), roles: ["finance"], reference: "UTR0001234567", requestId: req });
    const row = await Withdrawal.findById(id).lean();
    expect(row?.status).toBe("paid");
    expect(row?.reference).toBe("UTR0001234567");
    expect(await accountBalance("paid_out", vendor.id)).toBe(10);
    expect(await accountBalance("payout_pending", vendor.id)).toBe(0);
    expect(await accountBalance("vendor_earnings", vendor.id)).toBe(90);
  });

  it("cannot pay a payout that was never approved", async () => {
    const { id } = await requested("skip@example.com");
    await expect(markWithdrawalPaid({ id, actorId: uid(), roles: ["finance"], reference: "UTR0001234567", requestId: req })).rejects.toBeInstanceOf(ConflictError);
  });

  it("keeps the ledger balanced through every path", async () => {
    const { id } = await requested("balanced@example.com");
    await rejectWithdrawal({ id, actorId: uid(), roles: ["finance"], reason: "Bank details unclear", requestId: req });
    expect(await trialBalance()).toBe(0);
  });
});

describe("staff access", () => {
  it("only finance or superadmin can act on payouts", async () => {
    const vendor = await person("staff-vendor@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 20);
    const row = await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
    await expect(approveWithdrawal({ id: row.id, actorId: uid(), roles: ["user"], requestId: req })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listPayoutsForStaff({ roles: ["support"] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listPayoutsForStaff({ roles: ["finance"] })).resolves.toHaveLength(1);
  });

  it("a finance staff member can approve through the route; a plain user gets 403", async () => {
    const vendor = await person("route-vendor@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 20);
    const row = await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
    const finance = await person("route-finance@example.com", ["user", "finance"]);
    const denied = await call("POST", `/api/wallet/admin/payouts/${row.id}/approve`, vendor.cookie);
    expect(denied.status).toBe(403);
    const allowed = await call("POST", `/api/wallet/admin/payouts/${row.id}/approve`, finance.cookie);
    expect(allowed.status).toBe(200);
    expect(((await allowed.json()) as { data: { status: string } }).data.status).toBe("approved");
  });

  it("a vendor withdrawal through the route is refused under the cooldown", async () => {
    const vendor = await person("route-cooldown@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 20);
    const first = await call("POST", "/api/wallet/payouts/withdrawals", vendor.cookie, { coins: 5 });
    expect(first.status).toBe(200);
    const second = await call("POST", "/api/wallet/payouts/withdrawals", vendor.cookie, { coins: 5 });
    expect(second.status).toBe(409);
  });

  it("the admin queue shows masked payout details only", async () => {
    const vendor = await person("queue-vendor@example.com");
    await withKyc(vendor.id);
    await earn(vendor.id, 20);
    await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
    const [row] = await listPayoutsForStaff({ roles: ["superadmin"] });
    expect(row.payout?.accountNumber).toBe("********9012");
    expect(JSON.stringify(row)).not.toContain("123456789012");
  });
});

describe("payout KYC existence", () => {
  it("no record before submit, one record after", async () => {
    const vendor = await person("kyc-none@example.com");
    expect(await getPayoutKyc(vendor.id)).toBeNull();
    await expect(submitPayoutKyc({ userId: vendor.id, values: payoutKycSchema.parse(bankDetails), requestId: req, ip })).resolves.toBeDefined();
    expect(await PayoutKyc.countDocuments({ userId: vendor.id })).toBe(1);
  });
});
