import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as webhookPost } from "@/app/api/payments/coins/webhook/route";
import { GET as walletGet, POST as walletPost, PUT as walletPut } from "@/app/api/wallet/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { accountBalance, trialBalance } from "@/server/ledger";
import { AuditEvent, CreditPack, Session, User } from "@/server/models";
import { CoinPurchase, WEBHOOK_TOLERANCE_SECONDS, signWebhook } from "@/server/wallet";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const secret = "coin-webhook-secret";

async function account(email: string, roles = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

function call(method: "GET" | "POST" | "PUT", path: string, cookie: string, body?: unknown) {
  const headers = new Headers({ origin, cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return method === "GET" ? walletGet(request) : method === "PUT" ? walletPut(request) : walletPost(request);
}

function webhook(payload: unknown, opts: { at?: number; secretOverride?: string; tamper?: boolean } = {}) {
  const raw = JSON.stringify(payload);
  const at = opts.at ?? Math.floor(Date.now() / 1000);
  const signature = signWebhook(opts.secretOverride ?? secret, at, raw);
  return webhookPost(
    new Request(`${origin}/api/payments/coins/webhook`, {
      method: "POST",
      headers: { "x-payment-signature": signature, "x-payment-timestamp": String(at) },
      body: opts.tamper ? raw.replace("succeeded", "refunded") : raw,
    }),
  );
}

async function buy(user: { id: string; cookie: string }, packId: string, idempotencyKey = "coin-key-0001") {
  const response = await call("POST", "/api/wallet/coins/checkout", user.cookie, { packId, idempotencyKey });
  const body = (await response.json()) as { ok: boolean; data: { id: string; providerPaymentId: string; coins: number } };
  return body.data;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.PAYMENT_WEBHOOK_SECRET = secret;
  process.env.COIN_PAYMENT_PROVIDER = "mock";
  process.env.SESSION_SECRET = "session-secret";
  await connectMemoryMongo();
});
afterAll(async () => {
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  delete process.env.COIN_PAYMENT_PROVIDER;
  delete process.env.SESSION_SECRET;
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("buying coins", () => {
  it("credits nothing at checkout and exactly once on a verified webhook, even when replayed", async () => {
    const user = await account("buyer@example.test");
    const pack = await CreditPack.create({ credits: 5, price: 500, bonus: 0, status: "active", order: 1 });
    const purchase = await buy(user, String(pack._id));
    expect(purchase.coins).toBe(5);
    expect(await walletBalance(user.id)).toBe(0);

    const event = { eventId: "evt-1", providerPaymentId: purchase.providerPaymentId, status: "succeeded", amount: 500, currency: "INR" };
    const replays = await Promise.all([webhook(event), webhook(event), webhook({ ...event, eventId: "evt-2" })]);
    expect(replays.map((row) => row.status)).toEqual([200, 200, 200]);
    expect(await walletBalance(user.id)).toBe(5);
    expect(await accountBalance("external", "system")).toBe(-5);
    expect(await trialBalance()).toBe(0);
    expect((await CoinPurchase.findById(purchase.id))?.status).toBe("succeeded");

    await webhook(event);
    expect(await walletBalance(user.id)).toBe(5);
  });

  it("is idempotent on the checkout key", async () => {
    const user = await account("again@example.test");
    const pack = await CreditPack.create({ credits: 1, price: 100, status: "active" });
    const one = await buy(user, String(pack._id), "same-checkout-key");
    const two = await buy(user, String(pack._id), "same-checkout-key");
    expect(two.id).toBe(one.id);
    expect(await CoinPurchase.countDocuments({})).toBe(1);
  });

  it("refuses a missing, wrong, tampered or stale signature and credits nothing", async () => {
    const user = await account("sig@example.test");
    const pack = await CreditPack.create({ credits: 10, price: 1000, status: "active" });
    const purchase = await buy(user, String(pack._id));
    const event = { eventId: "evt-x", providerPaymentId: purchase.providerPaymentId, status: "succeeded" };
    const missing = await webhookPost(new Request(`${origin}/api/payments/coins/webhook`, { method: "POST", body: JSON.stringify(event) }));
    const wrong = await webhook(event, { secretOverride: "not-the-secret" });
    const tampered = await webhook(event, { tamper: true });
    const stale = await webhook(event, { at: Math.floor(Date.now() / 1000) - WEBHOOK_TOLERANCE_SECONDS - 5 });
    expect([missing.status, wrong.status, tampered.status, stale.status]).toEqual([400, 400, 400, 400]);
    expect(await walletBalance(user.id)).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "coins.webhook.rejected" })).toBe(4);
    const rejected = JSON.stringify(await AuditEvent.find({ action: "coins.webhook.rejected" }).lean());
    expect(rejected).not.toContain(secret);
  });

  it("refuses an event whose amount differs from the purchase", async () => {
    const user = await account("amt@example.test");
    const pack = await CreditPack.create({ credits: 5, price: 500, status: "active" });
    const purchase = await buy(user, String(pack._id));
    const response = await webhook({ eventId: "e", providerPaymentId: purchase.providerPaymentId, status: "succeeded", amount: 1 });
    expect(response.status).toBe(409);
    expect(await walletBalance(user.id)).toBe(0);
  });

  it("a failed payment credits nothing; a refund after success takes the coins back once", async () => {
    const user = await account("refund@example.test");
    const pack = await CreditPack.create({ credits: 5, price: 500, status: "active" });
    const failed = await buy(user, String(pack._id), "failed-key-0001");
    await webhook({ eventId: "f1", providerPaymentId: failed.providerPaymentId, status: "failed" });
    expect(await walletBalance(user.id)).toBe(0);
    expect((await CoinPurchase.findById(failed.id))?.status).toBe("failed");

    const paid = await buy(user, String(pack._id), "paid-key-00001");
    await webhook({ eventId: "p1", providerPaymentId: paid.providerPaymentId, status: "succeeded" });
    expect(await walletBalance(user.id)).toBe(5);
    await webhook({ eventId: "r1", providerPaymentId: paid.providerPaymentId, status: "refunded" });
    await webhook({ eventId: "r2", providerPaymentId: paid.providerPaymentId, status: "refunded" });
    expect(await walletBalance(user.id)).toBe(0);
    expect((await CoinPurchase.findById(paid.id))?.status).toBe("refunded");
    expect(await trialBalance()).toBe(0);
  });

  it("does not refund coins that were already spent, and keeps the purchase paid", async () => {
    const user = await account("spent@example.test");
    const pack = await CreditPack.create({ credits: 1, price: 100, status: "active" });
    const paid = await buy(user, String(pack._id));
    await webhook({ eventId: "p1", providerPaymentId: paid.providerPaymentId, status: "succeeded" });
    const { debitWallet } = await import("@/server/billing/ledger");
    await debitWallet({ userId: user.id, amount: 1, refType: "spend", refId: "s1", requestId: "r" });
    const refund = await webhook({ eventId: "r1", providerPaymentId: paid.providerPaymentId, status: "refunded" });
    expect(refund.status).toBe(402);
    expect((await CoinPurchase.findById(paid.id))?.status).toBe("succeeded");
  });

  it("lists packs as coins and snapshots the TDS and GST in force", async () => {
    const admin = await account("fin@example.test", ["finance"]);
    const user = await account("tax@example.test");
    await CreditPack.create({ credits: 1, price: 100, status: "active", order: 1 });
    const pack = await CreditPack.create({ credits: 10, price: 900, bonus: 1, status: "active", order: 2 });
    const denied = await call("PUT", "/api/wallet/admin/settings", user.cookie, { tdsPercent: 1 });
    expect(denied.status).toBe(403);
    const saved = await call("PUT", "/api/wallet/admin/settings", admin.cookie, { tdsPercent: 1, gstPercent: 18 });
    expect(saved.status).toBe(200);
    const bad = await call("PUT", "/api/wallet/admin/settings", admin.cookie, { tdsPercent: 120 });
    expect(bad.status).toBe(400);
    const shop = (await (await call("GET", "/api/wallet/coins", user.cookie)).json()) as {
      data: { coinValueInr: number; packs: Array<{ coins: number; price: number }> };
    };
    expect(shop.data.coinValueInr).toBe(100);
    expect(shop.data.packs.map((row) => row.coins)).toEqual([1, 11]);
    const purchase = await buy(user, String(pack._id));
    const row = await CoinPurchase.findById(purchase.id).lean();
    expect(row?.coins).toBe(11);
    expect([row?.tdsPercent, row?.gstPercent]).toEqual([1, 18]);
    expect(await AuditEvent.countDocuments({ action: "finance.settings.update" })).toBe(1);
  });

  it("legacy credits keep working beside the ledger (one wallet)", async () => {
    const user = await account("legacy@example.test");
    await creditWallet({ userId: user.id, amount: 7, refType: "pack", refId: "old", requestId: "r" });
    const pack = await CreditPack.create({ credits: 1, price: 100, status: "active" });
    const paid = await buy(user, String(pack._id));
    await webhook({ eventId: "p1", providerPaymentId: paid.providerPaymentId, status: "succeeded" });
    expect(await walletBalance(user.id)).toBe(8);
  });
});
