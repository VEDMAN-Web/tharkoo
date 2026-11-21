import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cronGet } from "@/app/api/cron/payments/route";
import { walletBalance } from "@/server/billing/ledger";
import { expireStalePassimpay, settlePassimpay, startRecharge } from "@/server/billing/recharge";
import { CreditPack, Payment, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

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
  process.env.PASSIMPAY_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.PAYMENT_PROVIDER = "mock";
  delete process.env.ALLOW_LIVE_PAYMENTS;
  delete process.env.PASSIMPAY_PLATFORM_ID;
  delete process.env.PASSIMPAY_API_KEY;
});

function fakePassimpay(status: { status: string; amountPaid?: string; currency?: string } = { status: "wait" }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("createorder")) return new Response(JSON.stringify({ result: 1, url: "https://pay.passimpay.io/invoice/abc" }));
      return new Response(JSON.stringify({ result: 1, amountPaid: "0", currency: "INR", ...status }));
    }),
  );
}

async function order(price = 499, credits = 100) {
  const user = await User.create({ email: `b${Math.random().toString(36).slice(2, 8)}@example.com`, displayName: "Asha", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
  const pack = await CreditPack.create({ credits, price, bonus: 0, status: "active", order: 0 });
  fakePassimpay();
  const started = await startRecharge({ userId: String(user._id), packId: String(pack._id), method: "crypto", requestId: "r1" });
  return { userId: String(user._id), paymentId: started.paymentId };
}

const hours = (n: number) => new Date(Date.now() + n * 60 * 60 * 1000);

describe("H18.5 unpaid crypto orders close after 2 hours", () => {
  it("leaves a 1-hour-old unpaid order waiting and closes it once it is over 2 hours old", async () => {
    const { paymentId } = await order();
    fakePassimpay({ status: "wait" });
    expect(await expireStalePassimpay("c1", hours(1))).toEqual({ checked: 0, paid: 0, expired: 0 });
    expect((await Payment.findById(paymentId).lean())?.status).toBe("pending");
    expect(await expireStalePassimpay("c2", hours(3))).toEqual({ checked: 1, paid: 0, expired: 1 });
    expect(await Payment.findById(paymentId).lean()).toMatchObject({ status: "failed", outcome: "expired" });
  });

  it("credits an order PassimPay reports paid instead of closing it", async () => {
    const { userId, paymentId } = await order();
    fakePassimpay({ status: "paid", amountPaid: "499.00", currency: "INR" });
    expect(await expireStalePassimpay("c1", hours(3))).toEqual({ checked: 1, paid: 1, expired: 0 });
    expect((await Payment.findById(paymentId).lean())?.status).toBe("paid");
    expect(await walletBalance(userId)).toBe(100);
  });

  it("still credits a real payment that arrives after the order was closed, exactly once", async () => {
    const { userId, paymentId } = await order();
    fakePassimpay({ status: "wait" });
    await expireStalePassimpay("c1", hours(3));
    expect(await settlePassimpay(paymentId, "late0")).toBe("failed");
    fakePassimpay({ status: "paid", amountPaid: "499.00", currency: "INR" });
    expect(await settlePassimpay(paymentId, "late1")).toBe("paid");
    expect(await settlePassimpay(paymentId, "late2")).toBe("paid");
    expect(await walletBalance(userId)).toBe(100);
  });

  it("the cron route needs the cron secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const denied = await cronGet(new Request("http://127.0.0.1/api/cron/payments/"));
    expect(denied.status).toBeGreaterThanOrEqual(401);
    const ok = await cronGet(new Request("http://127.0.0.1/api/cron/payments/", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(ok.status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});
