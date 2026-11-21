import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhookPost } from "@/app/api/payments/passimpay/webhook/route";
import { createInvoice, orderStatus, passimpayConfig, signBody, verifyWebhookSignature } from "@/server/billing/passimpay";
import { confirmNewestPassimpayForUser } from "@/server/billing/passimpay-events";
import { checkoutPack } from "@/server/billing/service";
import { walletBalance } from "@/server/billing/ledger";
import { InternalError, PolicyViolationError } from "@/server/http";
import { AuditEvent, CreditPack, Payment, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/**
 * H18.1: PassimPay crypto checkout. Every call to the provider is a mocked fetch: nothing here ever reaches the network.
 * The key is the fake "test-key" and the platform id is 123.
 */

const KEY = "test-key";
const PLATFORM = 123;
const CREATE_URL = "https://api.passimpay.io/v2/createorder";
const STATUS_URL = "https://api.passimpay.io/v2/orderstatus";

type Reply = { result: number; [key: string]: unknown };
let calls: { url: string; body: string; signature: string | null }[] = [];
let replies: Record<string, Reply | (() => Reply)> = {};

function stubFetch() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
      if (url !== CREATE_URL && url !== STATUS_URL) throw new Error(`unexpected network call: ${url}`);
      calls.push({ url, body: String(init?.body ?? ""), signature: init?.headers?.["x-signature"] ?? null });
      const reply = replies[url];
      const body = typeof reply === "function" ? reply() : reply;
      return new Response(JSON.stringify(body ?? { result: 0, message: "no reply set" }), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
}

function env(provider: string | undefined, live = "true") {
  if (provider) process.env.PAYMENT_PROVIDER = provider;
  else delete process.env.PAYMENT_PROVIDER;
  process.env.PASSIMPAY_PLATFORM_ID = String(PLATFORM);
  process.env.PASSIMPAY_API_KEY = KEY;
  process.env.ALLOW_LIVE_PAYMENTS = live;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  replies = {};
  stubFetch();
  env("passimpay");
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.PASSIMPAY_PLATFORM_ID;
  delete process.env.PASSIMPAY_API_KEY;
  process.env.ALLOW_LIVE_PAYMENTS = "false";
});

async function world() {
  const user = await User.create({ email: "buyer@example.test", passwordHash: "x", displayName: "Buyer", roles: ["user"], status: "active" });
  const pack = await CreditPack.create({ credits: 100, bonus: 10, price: 499, status: "active" });
  return { userId: String(user._id), packId: String(pack._id) };
}

async function pendingPayment(w: Awaited<ReturnType<typeof world>>) {
  const payment = await Payment.create({ userId: w.userId, orderId: w.packId, idempotencyKey: `k-${Math.random()}`, provider: "passimpay", amount: 499, currency: "INR", status: "pending", method: "crypto" });
  payment.providerRef = String(payment._id);
  await payment.save();
  return payment;
}

function webhook(orderId: string, opts: { sign?: boolean; spaced?: boolean; header?: string } = {}) {
  const body = { type: "deposit", platformId: PLATFORM, paymentId: 77, orderId, amount: "4.99", txhash: "0xabc", confirmations: 3 };
  const compact = JSON.stringify(body);
  const raw = opts.spaced ? JSON.stringify(body, null, 1) : compact;
  const signature = opts.header ?? (opts.sign === false ? "" : signBody(PLATFORM, opts.spaced ? compact : raw, KEY));
  return new Request("http://127.0.0.1:4317/api/payments/passimpay/webhook/", { method: "POST", body: raw, headers: { "content-type": "application/json", ...(signature ? { "x-signature": signature } : {}) } });
}

describe("signature", () => {
  it("signs platformId;body;key with HMAC-SHA256 as hex (fixed test vector)", () => {
    expect(signBody(PLATFORM, '{"a":1}', KEY)).toBe("aeff9defc8b31b059e0f9db3e7c3e66f0c93fa42b54540bd4f81ab724764f825");
  });

  it("accepts the signature over the body as received, or over the re-serialised body, and nothing else", () => {
    const compact = '{"orderId":"o1","type":"deposit"}';
    expect(verifyWebhookSignature(compact, signBody(PLATFORM, compact, KEY))).toEqual({ ok: true, form: "raw" });
    const spaced = '{ "orderId": "o1", "type": "deposit" }';
    expect(verifyWebhookSignature(spaced, signBody(PLATFORM, compact, KEY))).toEqual({ ok: true, form: "reserialized" });
    expect(verifyWebhookSignature(compact, signBody(PLATFORM, compact, "other-key"))).toEqual({ ok: false, form: null });
    expect(verifyWebhookSignature(compact, "")).toEqual({ ok: false, form: null });
    expect(verifyWebhookSignature("not json", "abc")).toEqual({ ok: false, form: null });
  });

  it("is off until both env names are set", () => {
    delete process.env.PASSIMPAY_API_KEY;
    expect(passimpayConfig()).toBeNull();
    expect(verifyWebhookSignature("{}", signBody(PLATFORM, "{}", KEY))).toEqual({ ok: false, form: null });
  });
});

describe("createInvoice and orderStatus", () => {
  it("createInvoice sends exactly the string it signed, and returns the payment url", async () => {
    replies[CREATE_URL] = { result: 1, url: "https://pay.example.test/invoice/1" };
    const out = await createInvoice({ orderId: "abc123", amountInr: 499 });
    expect(out.url).toBe("https://pay.example.test/invoice/1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toBe('{"platformId":123,"orderId":"abc123","amount":"499.00","symbol":"INR","type":1}');
    expect(calls[0]?.signature).toBe(signBody(PLATFORM, calls[0]?.body ?? "", KEY));
  });

  it("a refusal, a missing url or a broken answer is one plain error that names no key and no signature", async () => {
    for (const reply of [{ result: 0, message: "bad" }, { result: 1 }, { nonsense: true } as unknown as Reply]) {
      replies[CREATE_URL] = reply;
      const error = await createInvoice({ orderId: "abc", amountInr: 10 }).catch((e) => e);
      expect(error).toBeInstanceOf(InternalError);
      expect(String(error.message)).toBe("Payment provider is not available");
      expect(String(error.message)).not.toContain(KEY);
    }
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("socket hang up"))));
    await expect(createInvoice({ orderId: "abc", amountInr: 10 })).rejects.toBeInstanceOf(InternalError);
  });

  it("orderStatus reads the status, the amount and the currency", async () => {
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    expect(await orderStatus("abc")).toEqual({ status: "paid", amountPaid: 499, currency: "INR" });
    expect(calls[0]?.body).toBe('{"platformId":123,"orderId":"abc"}');
  });
});

describe("checkout", () => {
  it("creates the Payment first, uses its id as the order id, and returns the checkout url", async () => {
    const w = await world();
    replies[CREATE_URL] = { result: 1, url: "https://pay.example.test/invoice/9" };
    const out = await checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r1" });
    expect(out.provider).toBe("passimpay");
    expect((out as { checkoutUrl?: string }).checkoutUrl).toBe("https://pay.example.test/invoice/9");
    const payment = await Payment.findOne({}).lean();
    expect(payment?.provider).toBe("passimpay");
    expect(payment?.providerRef).toBe(String(payment?._id));
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({ orderId: String(payment?._id), amount: "499.00", symbol: "INR", type: 1 });
    expect(await walletBalance(w.userId)).toBe(0);
  });

  it("deletes the Payment when the provider cannot be reached", async () => {
    const w = await world();
    replies[CREATE_URL] = { result: 0, message: "down" };
    await expect(checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r2" })).rejects.toBeInstanceOf(InternalError);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("makes no order at all unless live payments are allowed", async () => {
    env("passimpay", "false");
    const w = await world();
    await expect(checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r3" })).rejects.toBeInstanceOf(PolicyViolationError);
    expect(calls).toHaveLength(0);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("the mock path is unchanged when PAYMENT_PROVIDER is not passimpay", async () => {
    env(undefined, "false");
    const w = await world();
    const out = await checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r4" });
    expect(out.provider).toBe("mock");
    expect((out as { checkoutUrl?: string }).checkoutUrl).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("the webhook", () => {
  it("a bad or missing signature is refused with 400 and an audit entry that holds no value", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    for (const request of [webhook(String(payment._id), { header: "deadbeef" }), webhook(String(payment._id), { sign: false })]) {
      const res = await webhookPost(request);
      expect(res.status).toBe(400);
    }
    expect(await AuditEvent.countDocuments({ action: "payment.webhook.rejected" })).toBe(2);
    const text = JSON.stringify(await AuditEvent.find({ action: "payment.webhook.rejected" }).lean());
    expect(text).not.toContain("deadbeef");
    expect(text).not.toContain(KEY);
    expect(calls).toHaveLength(0);
    expect(await walletBalance(w.userId)).toBe(0);
  });

  it("a good signature and status paid credits the pack and its bonus once", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    const res = await webhookPost(webhook(String(payment._id)));
    expect(res.status).toBe(200);
    expect(await walletBalance(w.userId)).toBe(110);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("paid");
  });

  it("the same webhook twice credits once", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    expect((await webhookPost(webhook(String(payment._id)))).status).toBe(200);
    expect((await webhookPost(webhook(String(payment._id)))).status).toBe(200);
    expect(await walletBalance(w.userId)).toBe(110);
  });

  it("a signed body alone never credits: the status is confirmed with the provider, and wait credits nothing", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "wait", amountPaid: "0", currency: "INR" };
    const res = await webhookPost(webhook(String(payment._id)));
    expect(res.status).toBe(200);
    expect(calls.map((call) => call.url)).toEqual([STATUS_URL]);
    expect(await walletBalance(w.userId)).toBe(0);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("pending");
  });

  it("an INR amount below the price credits nothing", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "100.00", currency: "INR" };
    const res = await webhookPost(webhook(String(payment._id)));
    expect(res.status).toBe(409);
    expect(await walletBalance(w.userId)).toBe(0);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("pending");
  });

  it("status error marks the payment failed and credits nothing", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "error", amountPaid: "0", currency: "INR" };
    expect((await webhookPost(webhook(String(payment._id)))).status).toBe(200);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("failed");
    expect(await walletBalance(w.userId)).toBe(0);
  });

  it("an unknown order is a 200 no-op with no call to the provider", async () => {
    await world();
    const res = await webhookPost(webhook(String(new mongoose.Types.ObjectId())));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
    const res2 = await webhookPost(webhook("not-an-order"));
    expect(res2.status).toBe(200);
  });

  it("a body signed over the re-serialised JSON is accepted", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    const res = await webhookPost(webhook(String(payment._id), { spaced: true }));
    expect(res.status).toBe(200);
    expect(await walletBalance(w.userId)).toBe(110);
  });
});

describe("the return from the payment page", () => {
  it("credits the newest pending PassimPay payment of the signed-in user once, so a lost webhook still pays", async () => {
    const w = await world();
    await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00", currency: "INR" };
    expect(await confirmNewestPassimpayForUser(w.userId, "r5")).toBe("paid");
    expect(await confirmNewestPassimpayForUser(w.userId, "r6")).toBe("none");
    expect(await walletBalance(w.userId)).toBe(110);
  });

  it("does nothing when the payment is still waiting, and never throws when the provider is down", async () => {
    const w = await world();
    await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "wait", amountPaid: "0", currency: "INR" };
    expect(await confirmNewestPassimpayForUser(w.userId, "r7")).toBe("wait");
    replies[STATUS_URL] = { result: 0, message: "down" };
    expect(await confirmNewestPassimpayForUser(w.userId, "r8")).toBe("unavailable");
    expect(await walletBalance(w.userId)).toBe(0);
  });
});

describe("review fixes", () => {
  it("no other webhook can credit or change a PassimPay payment: only the PassimPay confirmation can", async () => {
    const { applyWebhook } = await import("@/server/billing/service");
    const { ForbiddenError } = await import("@/server/http");
    const w = await world();
    const payment = await pendingPayment(w);
    await expect(applyWebhook({ eventId: "generic-1", providerRef: String(payment._id), status: "paid" }, "r9")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(applyWebhook({ eventId: "generic-2", providerRef: String(payment._id), status: "failed" }, "r9")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await walletBalance(w.userId)).toBe(0);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("pending");
  });

  it("a paid answer with no currency credits nothing (the amount cannot be checked)", async () => {
    const w = await world();
    const payment = await pendingPayment(w);
    replies[STATUS_URL] = { result: 1, status: "paid", amountPaid: "499.00" };
    expect((await webhookPost(webhook(String(payment._id)))).status).toBe(409);
    expect(await walletBalance(w.userId)).toBe(0);
  });

  it("a very large body is refused before any work", async () => {
    const big = new Request("http://127.0.0.1:4317/api/payments/passimpay/webhook/", { method: "POST", body: "x".repeat(20_000), headers: { "x-signature": "abc" } });
    expect((await webhookPost(big)).status).toBe(413);
    expect(await AuditEvent.countDocuments({ action: "payment.webhook.rejected" })).toBe(0);
  });

  it("repeating a checkout with the same key does not send the buyer to the test payment page", async () => {
    const w = await world();
    replies[CREATE_URL] = { result: 1, url: "https://pay.example.test/invoice/2" };
    await checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r10", idempotencyKey: "same-key-123" });
    await expect(checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r11", idempotencyKey: "same-key-123" })).rejects.toThrow(/already open/);
  });

  it("the order id is saved before the invoice is opened, and the Payment stays once the invoice exists", async () => {
    const w = await world();
    replies[CREATE_URL] = () => {
      return { result: 1, url: "https://pay.example.test/invoice/3" };
    };
    await checkoutPack({ userId: w.userId, packId: w.packId, requestId: "r12" });
    const payment = await Payment.findOne({}).lean();
    expect(payment?.providerRef).toBe(String(payment?._id));
    expect(payment?.status).toBe("pending");
  });
});
