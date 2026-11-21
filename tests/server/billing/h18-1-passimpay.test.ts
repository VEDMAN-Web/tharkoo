import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as paymentsPost } from "@/app/api/payments/[[...slug]]/route";
import { walletBalance } from "@/server/billing/ledger";
import { createInvoice, orderStatus, passimpaySignature, verifyNotice } from "@/server/billing/passimpay";
import { listOwnPayments, readOwnPayment, settlePassimpay, startRecharge } from "@/server/billing/recharge";
import { CreditPack, Payment, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const KEY = "test-key";

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
  process.env.PAYMENT_PROVIDER = "passimpay";
  process.env.ALLOW_LIVE_PAYMENTS = "true";
  process.env.PASSIMPAY_PLATFORM_ID = "123";
  process.env.PASSIMPAY_API_KEY = KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.PAYMENT_PROVIDER = "mock";
  delete process.env.ALLOW_LIVE_PAYMENTS;
  delete process.env.PASSIMPAY_PLATFORM_ID;
  delete process.env.PASSIMPAY_API_KEY;
});

async function buyer() {
  return User.create({ email: `b${Math.random().toString(36).slice(2, 8)}@example.com`, displayName: "Asha", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
}

/** A fake PassimPay: createorder returns a url, orderstatus returns the given status. Records every call. */
function fakePassimpay(status: { status: string; amountPaid?: string; currency?: string } = { status: "wait" }) {
  const calls: { path: string; body: string; signature: string | null }[] = [];
  const fake = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.split("/").pop() as string;
    calls.push({ path, body: String(init.body), signature: (init.headers as Record<string, string>)["x-signature"] ?? null });
    if (path === "createorder") return new Response(JSON.stringify({ result: 1, url: "https://pay.passimpay.io/invoice/abc" }));
    return new Response(JSON.stringify({ result: 1, amountPaid: "0", currency: "INR", ...status }));
  });
  vi.stubGlobal("fetch", fake);
  return calls;
}

describe("H18.1 PassimPay signing", () => {
  it("signs platformId;body;key with HMAC-SHA256 hex and sends exactly the signed body", async () => {
    expect(passimpaySignature(123, '{"a":1}', KEY)).toMatch(/^[0-9a-f]{64}$/);
    const calls = fakePassimpay();
    await createInvoice({ orderId: "65f0a1b2c3d4e5f6a7b8c9d0", amountInr: 499 });
    expect(calls[0].path).toBe("createorder");
    expect(JSON.parse(calls[0].body)).toMatchObject({ platformId: 123, orderId: "65f0a1b2c3d4e5f6a7b8c9d0", amount: "499.00", symbol: "INR", type: 1 });
    expect(calls[0].signature).toBe(passimpaySignature(123, calls[0].body, KEY));
    const status = await orderStatus("65f0a1b2c3d4e5f6a7b8c9d0");
    expect(status.status).toBe("wait");
  });

  it("accepts a notice signed over the raw body and refuses a wrong or missing signature", () => {
    const raw = JSON.stringify({ type: "deposit", platformId: 123, orderId: "abc_1", amount: "0.1" });
    expect(verifyNotice(raw, passimpaySignature(123, raw, KEY))).toEqual({ ok: true, orderId: "abc_1" });
    expect(verifyNotice(raw, "0".repeat(64)).ok).toBe(false);
    expect(verifyNotice(raw, null).ok).toBe(false);
  });
});

describe("H18.1 PassimPay recharge", () => {
  it("sends the buyer to the PassimPay page, and credits only when PassimPay says paid, once", async () => {
    const user = await buyer();
    const pack = await CreditPack.create({ credits: 100, price: 499, bonus: 0, status: "active", order: 0 });
    fakePassimpay({ status: "wait" });
    const started = await startRecharge({ userId: String(user._id), packId: String(pack._id), method: "card", requestId: "r1" });
    expect(started.checkoutPath).toBe("https://pay.passimpay.io/invoice/abc");
    const row = await Payment.findById(started.paymentId).lean();
    expect(row).toMatchObject({ provider: "passimpay", providerRef: started.paymentId, status: "pending", method: "crypto" });
    expect(await settlePassimpay(started.paymentId, "r2")).toBe("wait");
    expect(await walletBalance(String(user._id))).toBe(0);
    fakePassimpay({ status: "paid", amountPaid: "499.00", currency: "INR" });
    expect(await settlePassimpay(started.paymentId, "r3")).toBe("paid");
    expect(await settlePassimpay(started.paymentId, "r4")).toBe("paid");
    expect(await walletBalance(String(user._id))).toBe(100);
    expect((await readOwnPayment(String(user._id), started.paymentId)).status).toBe("paid");
  });

  it("does not credit an underpaid rupee invoice, and a lost notice is settled from the history", async () => {
    const user = await buyer();
    const pack = await CreditPack.create({ credits: 100, price: 499, bonus: 0, status: "active", order: 0 });
    fakePassimpay();
    const started = await startRecharge({ userId: String(user._id), packId: String(pack._id), method: "crypto", requestId: "r1" });
    fakePassimpay({ status: "paid", amountPaid: "300.00", currency: "INR" });
    expect(await settlePassimpay(started.paymentId, "r2")).toBe("wait");
    expect(await walletBalance(String(user._id))).toBe(0);
    fakePassimpay({ status: "paid", amountPaid: "499.00", currency: "INR" });
    await listOwnPayments(String(user._id), 1, 10);
    expect(await walletBalance(String(user._id))).toBe(100);
  });

  it("the notice route: bad signature 400 with nothing credited; good signature asks PassimPay and credits", async () => {
    const user = await buyer();
    const pack = await CreditPack.create({ credits: 50, price: 250, bonus: 0, status: "active", order: 0 });
    fakePassimpay();
    const started = await startRecharge({ userId: String(user._id), packId: String(pack._id), method: "crypto", requestId: "r1" });
    const raw = JSON.stringify({ type: "deposit", platformId: 123, orderId: started.paymentId, amount: "3.1" });
    const url = "http://127.0.0.1/api/payments/passimpay/webhook/";
    fakePassimpay({ status: "paid", amountPaid: "250.00", currency: "INR" });
    const bad = await paymentsPost(new Request(url, { method: "POST", body: raw, headers: { "x-signature": "f".repeat(64), "content-type": "application/json" } }));
    expect(bad.status).toBe(400);
    expect(await walletBalance(String(user._id))).toBe(0);
    const good = await paymentsPost(new Request(url, { method: "POST", body: raw, headers: { "x-signature": passimpaySignature(123, raw, KEY), "content-type": "application/json" } }));
    expect(good.status).toBe(200);
    expect(await walletBalance(String(user._id))).toBe(50);
  });

  it("refuses to start when live payments are not allowed", async () => {
    const user = await buyer();
    const pack = await CreditPack.create({ credits: 100, price: 499, bonus: 0, status: "active", order: 0 });
    delete process.env.ALLOW_LIVE_PAYMENTS;
    fakePassimpay();
    await expect(startRecharge({ userId: String(user._id), packId: String(pack._id), method: "crypto", requestId: "r1" })).rejects.toThrow(/not available/);
  });
});
