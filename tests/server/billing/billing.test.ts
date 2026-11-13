import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as couponPost } from "@/app/api/coupons/[[...slug]]/route";
import { POST as cronPost } from "@/app/api/cron/boost/route";
import { POST as paymentPost } from "@/app/api/payments/[[...slug]]/route";
import { webhookSignature } from "@/server/billing/provider";
import { POST as promotionPost } from "@/app/api/promotions/[[...slug]]/route";
import { GET as walletGet, POST as walletPost } from "@/app/api/wallet/[[...slug]]/route";
import { createCheckoutOrder } from "@/server/billing/provider";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { hashToken } from "@/server/auth/http";
import { PaymentRequiredError } from "@/server/http";
import { AuditEvent, Coupon, CreditPack, Listing, Payment, PromotionOrder, PromotionProduct, Session, User, WalletEntry } from "@/server/models";
import { compareRank, rankScore } from "@/server/ranking";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const webhookSecret = "webhook-secret";

/** Headers a provider sends with a webhook: the signature covers the timestamp and the body. */
function signedWebhook(raw: string, timestamp = Math.floor(Date.now() / 1000)) {
  return { "x-payment-signature": webhookSignature(webhookSecret, timestamp, raw), "x-payment-timestamp": String(timestamp) };
}
const cronSecret = "cron-secret";
const HOUR = 60 * 60 * 1000;

type Envelope = {
  ok: boolean;
  data: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
};

function envDefaults() {
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;
  process.env.CRON_SECRET = cronSecret;
  process.env.ALLOW_LIVE_PAYMENTS = "false";
  process.env.SESSION_SECRET = "session-secret";
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
}

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
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

async function listingFor(ownerId: string, cityId: mongoose.Types.ObjectId) {
  const doc = await Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    cityId,
    title: "Desk",
    description: "A wooden desk",
    status: "active",
  });
  return doc._id.toString();
}

async function product(code: string, amount: number, durationDays: number) {
  const doc = await PromotionProduct.create({
    code,
    name: code,
    description: `${code} placement`,
    amount,
    currency: "INR",
    durationDays,
    enabled: true,
  });
  return doc._id.toString();
}

function post(pathname: string, body?: unknown, cookie?: string, headers?: Record<string, string>) {
  const requestHeaders = new Headers({ origin, ...headers });
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  if (cookie) requestHeaders.set("cookie", cookie);
  const request = new Request(`${origin}${pathname}`, {
    method: "POST",
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (pathname.startsWith("/api/promotions")) return promotionPost(request);
  if (pathname.startsWith("/api/coupons")) return couponPost(request);
  if (pathname.startsWith("/api/cron")) return cronPost(request);
  if (pathname.startsWith("/api/wallet")) return walletPost(request);
  return paymentPost(request);
}

async function bodyOf(response: Response) {
  return (await response.json()) as Envelope;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  envDefaults();
  await connectMemoryMongo();
});

afterAll(async () => {
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  delete process.env.CRON_SECRET;
  delete process.env.ALLOW_LIVE_PAYMENTS;
  delete process.env.SESSION_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  envDefaults();
  await clearMemoryMongo();
});

describe("ranking", () => {
  it("orders by paid tier, then verified, then freshness", () => {
    const earlier = new Date("2026-05-01T00:00:00.000Z");
    const mid = new Date("2026-05-15T00:00:00.000Z");
    const later = new Date("2026-06-02T00:00:00.000Z");
    const now = new Date("2026-06-01T00:00:00.000Z");
    const future = new Date("2026-06-10T00:00:00.000Z");
    const active = { status: "active" as const, startsAt: earlier, endsAt: future };
    const rows = [
      { id: "failed-star", listing: { publishedAt: new Date("2026-03-01T00:00:00.000Z") }, promotions: [{ code: "star", status: "failed", startsAt: earlier, endsAt: future }] },
      { id: "future-star", listing: { publishedAt: new Date("2026-02-01T00:00:00.000Z") }, promotions: [{ code: "star", status: "active", startsAt: future, endsAt: new Date("2026-06-20T00:00:00.000Z") }] },
      { id: "expired-star", listing: { publishedAt: new Date("2026-04-01T00:00:00.000Z") }, promotions: [{ code: "star", status: "active", startsAt: new Date("2026-04-01T00:00:00.000Z"), endsAt: earlier }] },
      { id: "old-bump", listing: { publishedAt: later, bumpedAt: earlier }, promotions: [] },
      { id: "mid-publish", listing: { publishedAt: mid }, promotions: [] },
      { id: "bumped-fresh", listing: { publishedAt: earlier, bumpedAt: later }, promotions: [] },
      { id: "free-verified", listing: { verified: true, publishedAt: new Date("2026-01-01T00:00:00.000Z") }, promotions: [] },
      { id: "auto", listing: { publishedAt: earlier }, promotions: [{ code: "auto-boost", ...active }] },
      { id: "new-label", listing: { publishedAt: earlier }, promotions: [{ code: "new", ...active }] },
      { id: "highlight", listing: { publishedAt: earlier }, promotions: [{ code: "highlight", ...active }] },
      { id: "top-unverified-fresh", listing: { bumpedAt: later, publishedAt: earlier }, promotions: [{ code: "top", ...active }] },
      { id: "top-verified-stale", listing: { verified: true, publishedAt: earlier }, promotions: [{ code: "top", ...active }] },
      { id: "flash", listing: { publishedAt: earlier }, promotions: [{ code: "flash", ...active }] },
      { id: "super", listing: { publishedAt: earlier }, promotions: [{ code: "super-top", ...active }] },
      { id: "star", listing: { publishedAt: earlier }, promotions: [{ code: "star", ...active }] },
    ];
    const ordered = [...rows].sort((left, right) =>
      compareRank(rankScore(left.listing, left.promotions, now), rankScore(right.listing, right.promotions, now)),
    );
    expect(ordered.map((row) => row.id)).toEqual([
      "star",
      "super",
      "flash",
      "top-verified-stale",
      "top-unverified-fresh",
      "highlight",
      "new-label",
      "auto",
      "free-verified",
      "bumped-fresh",
      "mid-publish",
      "old-bump",
      "expired-star",
      "failed-star",
      "future-star",
    ]);
  });
});

describe("billing", () => {
  it("credits a pack once when the webhook is delivered twice and rejects a bad signature", async () => {
    const user = await account("ada@example.com");
    const pack = await CreditPack.create({ credits: 50, price: 500, bonus: 0, status: "active", order: 0 });
    const checkout = await bodyOf(
      await post("/api/payments/checkout", { packId: String(pack._id) }, user.cookie),
    );
    expect(checkout.ok).toBe(true);
    expect(String(checkout.data?.providerRef)).toMatch(/^pay_test_/);
    const payload = { eventId: "evt-1", status: "paid", providerRef: checkout.data?.providerRef };
    const raw = JSON.stringify(payload);
    const signed = new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signedWebhook(raw) },
      body: raw,
    });
    const first = await bodyOf(await paymentPost(signed));
    const second = await bodyOf(await paymentPost(new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signedWebhook(raw) },
      body: raw,
    })));
    expect(first).toMatchObject({ ok: true, data: { received: true } });
    expect(second).toMatchObject({ ok: true, data: { received: true } });
    expect(await walletBalance(user.id)).toBe(50);
    const entries = await WalletEntry.find({ userId: user.id }).lean();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.delta).toBe(50);

    const bad = await paymentPost(new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment-signature": "nope", "x-payment-timestamp": String(Math.floor(Date.now() / 1000)) },
      body: raw,
    }));
    expect(bad.status).toBe(400);
    expect(await walletBalance(user.id)).toBe(50);
    const rejected = await AuditEvent.findOne({ action: "payment.webhook.rejected" }).lean();
    expect(rejected?.after).toEqual({ reason: "bad-signature" });
    const audits = JSON.stringify(await AuditEvent.find({ targetId: user.id }).lean());
    expect(audits).not.toContain(webhookSecret);
    expect(audits).not.toContain("pay_test_");
  });

  it("refuses a correctly signed webhook older than five minutes and records why", async () => {
    const raw = JSON.stringify({ eventId: "evt-old", status: "paid", providerRef: "pay_test_missing" });
    const stale = Math.floor(Date.now() / 1000) - 600;
    const res = await paymentPost(new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signedWebhook(raw, stale) },
      body: raw,
    }));
    expect(res.status).toBe(400);
    const rejected = await AuditEvent.findOne({ action: "payment.webhook.rejected", "after.reason": "stale" }).lean();
    expect(rejected).not.toBeNull();
  });

  it("refuses a webhook with no timestamp", async () => {
    const raw = JSON.stringify({ eventId: "evt-none", status: "paid", providerRef: "pay_test_missing" });
    const res = await paymentPost(new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment-signature": webhookSignature(webhookSecret, 0, raw) },
      body: raw,
    }));
    expect(res.status).toBe(400);
  });

  it("credits a payment once when two different paid deliveries arrive at the same time", async () => {
    const user = await account("parallel@example.com");
    const pack = await CreditPack.create({ credits: 50, price: 500, bonus: 0, status: "active", order: 0 });
    const checkout = await bodyOf(await post("/api/payments/checkout", { packId: String(pack._id) }, user.cookie));
    const providerRef = checkout.data?.providerRef;
    const deliver = (eventId: string) => {
      const raw = JSON.stringify({ eventId, status: "paid", providerRef });
      return paymentPost(new Request(`${origin}/api/payments/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", ...signedWebhook(raw) },
        body: raw,
      }));
    };
    const results = await Promise.all([deliver("evt-parallel-a"), deliver("evt-parallel-b")]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await walletBalance(user.id)).toBe(50);
    expect(await WalletEntry.countDocuments({ userId: user.id })).toBe(1);
  });

  it("rejects overspending with 402 and leaves the balance unchanged", async () => {
    const user = await account("bee@example.com");
    const cityId = new mongoose.Types.ObjectId();
    const listingId = await listingFor(user.id, cityId);
    const productId = await product("top", 80, 1);
    await creditWallet({ userId: user.id, amount: 50, refType: "seed", refId: "seed", requestId: "seed", actorId: user.id });
    const before = await WalletEntry.find({ userId: user.id }).lean();
    const response = await post("/api/promotions", { listingId, productId }, user.cookie);
    const body = await bodyOf(response);
    expect(response.status).toBe(402);
    expect(body.error?.code).toBe("PAYMENT_REQUIRED");
    expect(await walletBalance(user.id)).toBe(50);
    const after = await WalletEntry.find({ userId: user.id }).lean();
    expect(after).toHaveLength(before.length);
    expect(after[0]?.delta).toBe(before[0]?.delta);
    expect(after[0]?.balanceAfter).toBe(before[0]?.balanceAfter);
    expect(await PromotionOrder.countDocuments({ status: "active" })).toBe(0);
  });

  it("lets only one of two concurrent debits succeed", async () => {
    const user = await account("cy@example.com");
    await creditWallet({ userId: user.id, amount: 100, refType: "seed", refId: "seed", requestId: "seed", actorId: user.id });
    const results = await Promise.allSettled([
      debitWallet({ userId: user.id, amount: 60, refType: "spend", refId: "a", requestId: "a", actorId: user.id }),
      debitWallet({ userId: user.id, amount: 60, refType: "spend", refId: "b", requestId: "b", actorId: user.id }),
    ]);
    const ok = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter((result) => result.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect((denied[0] as PromiseRejectedResult).reason).toBeInstanceOf(PaymentRequiredError);
    expect(await walletBalance(user.id)).toBe(40);
  });

  it("enforces coupon expiry, total uses, and the per-user limit", async () => {
    const user = await account("dee@example.com");
    const other = await account("eve@example.com");
    await Coupon.create({ code: "gone", kind: "credits", credits: 10, status: "active", expiresAt: new Date(Date.now() - 60_000) });
    await Coupon.create({ code: "once", kind: "credits", credits: 15, status: "active", maxRedemptions: 1, perUserLimit: 1 });
    await Coupon.create({ code: "personal", kind: "credits", credits: 5, status: "active", perUserLimit: 1 });
    const expired = await bodyOf(await post("/api/coupons/redeem", { code: "gone" }, user.cookie));
    expect(expired.error).toMatchObject({ code: "CONFLICT", message: "Coupon is expired" });
    const missing = await bodyOf(await post("/api/coupons/redeem", { code: "nope" }, user.cookie));
    expect(missing.error).toMatchObject({ code: "NOT_FOUND", message: "Coupon is invalid" });
    const first = await bodyOf(await post("/api/coupons/redeem", { code: "once" }, user.cookie));
    expect(first.data).toMatchObject({ credit: 15 });
    const secondUser = await bodyOf(await post("/api/coupons/redeem", { code: "once" }, other.cookie));
    expect(secondUser.error).toMatchObject({ code: "CONFLICT", message: "Coupon is used up" });
    expect((await bodyOf(await post("/api/coupons/redeem", { code: "personal" }, user.cookie))).ok).toBe(true);
    const again = await bodyOf(await post("/api/coupons/redeem", { code: "personal" }, user.cookie));
    expect(again.error).toMatchObject({ code: "CONFLICT", message: "Coupon is used up" });

    const cityId = new mongoose.Types.ObjectId();
    const listingId = await listingFor(user.id, cityId);
    const productId = await product("highlight", 100, 3);
    await Coupon.create({ code: "quarter", kind: "percent", percent: 25, status: "active", perUserLimit: 1 });
    await creditWallet({ userId: user.id, amount: 100, refType: "seed", refId: "promo-seed", requestId: "seed", actorId: user.id });
    const bought = await bodyOf(await post("/api/promotions", { listingId, productId, couponCode: "quarter" }, user.cookie));
    expect(bought.ok).toBe(true);
    expect(await walletBalance(user.id)).toBe(45);
    const reused = await bodyOf(await post("/api/promotions", { listingId, productId, couponCode: "quarter", idempotencyKey: "second-key" }, user.cookie));
    expect(reused.error).toMatchObject({ code: "CONFLICT", message: "Coupon is used up" });
    expect(await walletBalance(user.id)).toBe(45);
  });

  it("refuses a non-owner and a full star city", async () => {
    const owner = await account("owner@example.com");
    const stranger = await account("stranger@example.com");
    const cityId = new mongoose.Types.ObjectId();
    const otherCity = new mongoose.Types.ObjectId();
    const starId = await product("star", 10, 7);
    await creditWallet({ userId: owner.id, amount: 100, refType: "seed", refId: "seed", requestId: "seed", actorId: owner.id });
    const owned = await listingFor(owner.id, cityId);
    const denied = await post("/api/promotions", { listingId: owned, productId: starId }, stranger.cookie);
    expect(denied.status).toBe(403);
    expect((await bodyOf(denied)).error?.code).toBe("FORBIDDEN");
    expect(await walletBalance(owner.id)).toBe(100);
    for (let i = 0; i < 6; i += 1) {
      const listingId = await listingFor(owner.id, cityId);
      const response = await post("/api/promotions", { listingId, productId: starId, idempotencyKey: `star-${i}-key` }, owner.cookie);
      expect(response.status).toBe(200);
    }
    const full = await post("/api/promotions", { listingId: owned, productId: starId, idempotencyKey: "star-full-key" }, owner.cookie);
    expect(full.status).toBe(409);
    expect((await bodyOf(full)).error?.code).toBe("CONFLICT");
    expect(await walletBalance(owner.id)).toBe(40);
    const elsewhere = await listingFor(owner.id, otherCity);
    const allowed = await bodyOf(await post("/api/promotions", { listingId: elsewhere, productId: starId, idempotencyKey: "star-other-key" }, owner.cookie));
    expect(allowed.ok).toBe(true);
    expect(await walletBalance(owner.id)).toBe(30);
  });

  it("expires a promotion through cron and applies a due boost once", async () => {
    const user = await account("fay@example.com");
    const cityId = new mongoose.Types.ObjectId();
    const listingId = await listingFor(user.id, cityId);
    const topId = await product("top", 10, 1);
    const flashId = await product("flash", 10, 1);
    const boostId = await product("auto-boost", 10, 1);
    await creditWallet({ userId: user.id, amount: 100, refType: "seed", refId: "seed", requestId: "seed", actorId: user.id });
    const top = await bodyOf(await post("/api/promotions", { listingId, productId: topId, durationDays: 1, idempotencyKey: "top-key-1" }, user.cookie));
    const flashListing = await listingFor(user.id, cityId);
    const flash = await bodyOf(await post("/api/promotions", { listingId: flashListing, productId: flashId, idempotencyKey: "flash-key-1" }, user.cookie));
    const boostListing = await listingFor(user.id, cityId);
    const boost = await bodyOf(await post("/api/promotions", { listingId: boostListing, productId: boostId, idempotencyKey: "boost-key-1" }, user.cookie));
    expect(Date.parse(String(top.data?.endsAt)) - Date.parse(String(top.data?.startsAt))).toBe(24 * HOUR);
    expect(Date.parse(String(flash.data?.endsAt)) - Date.parse(String(flash.data?.startsAt))).toBe(4 * HOUR);
    expect(Date.parse(String(boost.data?.endsAt)) - Date.parse(String(boost.data?.startsAt))).toBe(6 * HOUR);

    await PromotionOrder.create({
      userId: user.id,
      listingId,
      productId: topId,
      status: "active",
      durationDays: 1,
      startsAt: new Date(Date.now() - 2 * HOUR),
      endsAt: new Date(Date.now() - HOUR),
    });
    const missing = await cronPost(new Request(`${origin}/api/cron/boost`, { method: "POST", body: "{}" }));
    expect(missing.status).toBe(401);
    const first = await bodyOf(await post("/api/cron/boost", {}, undefined, { "x-cron-secret": cronSecret }));
    expect(first.data).toMatchObject({ expired: 1 });
    expect(Number(first.data?.boosted)).toBeGreaterThan(0);
    const raw = await Listing.collection.findOne({ _id: new mongoose.Types.ObjectId(listingId) });
    expect(raw?.bumpedAt).toBeInstanceOf(Date);
    const ended = await PromotionOrder.findOne({ endsAt: { $lte: new Date() } }).lean();
    expect(ended?.status).toBe("failed");
    const second = await bodyOf(await post("/api/cron/boost", {}, undefined, { "x-cron-secret": cronSecret }));
    expect(second.data).toMatchObject({ boosted: 0, expired: 0 });
  });

  it("refunds a paid pack for finance and writes an audit event", async () => {
    const buyer = await account("gia@example.com");
    const finance = await account("fin@example.com", ["finance"]);
    const stranger = await account("hal@example.com");
    const pack = await CreditPack.create({ credits: 40, price: 400, bonus: 10, status: "active", order: 1 });
    const checkout = await bodyOf(await post("/api/payments/checkout", { packId: String(pack._id), idempotencyKey: "pack-key-1" }, buyer.cookie));
    const again = await bodyOf(await post("/api/payments/checkout", { packId: String(pack._id), idempotencyKey: "pack-key-1" }, buyer.cookie));
    expect(again.data?.paymentId).toBe(checkout.data?.paymentId);
    const payload = { eventId: "evt-refund", status: "paid" as const, providerRef: checkout.data?.providerRef };
    const raw = JSON.stringify(payload);
    await paymentPost(new Request(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signedWebhook(raw) },
      body: raw,
    }));
    expect(await walletBalance(buyer.id)).toBe(50);
    const wallet = await bodyOf(await walletGet(new Request(`${origin}/api/wallet`, { headers: { cookie: buyer.cookie, origin } })));
    expect(wallet.data).toEqual({ balance: 50 });
    const forbidden = await post("/api/payments/refund", { paymentId: checkout.data?.paymentId, amount: 10, reason: "goodwill" }, stranger.cookie);
    expect(forbidden.status).toBe(403);
    const refunded = await bodyOf(await post("/api/payments/refund", { paymentId: checkout.data?.paymentId, amount: 10, reason: "goodwill" }, finance.cookie));
    expect(refunded.ok).toBe(true);
    expect(await walletBalance(buyer.id)).toBe(60);
    const duplicate = await post("/api/payments/refund", { paymentId: checkout.data?.paymentId, amount: 10, reason: "goodwill" }, finance.cookie);
    expect(duplicate.status).toBe(409);
    const payment = await Payment.findById(checkout.data?.paymentId).lean();
    expect(payment?.status).toBe("paid");
    const entry = await WalletEntry.findOne({ refType: "refund" }).lean();
    expect(entry?.reason).toBe("refund");
    expect(entry?.delta).toBe(10);
    const trail = await AuditEvent.findOne({ action: "wallet.refund" }).lean();
    expect(trail?.actorId?.toString()).toBe(finance.id);
    expect(JSON.stringify(trail)).not.toContain(webhookSecret);
  });

  it("refuses a live key unless live payments are allowed and does not call the network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const live = ["rzp", "live", "example"].join("_");
    process.env.PAYMENT_PROVIDER = "razorpay";
    process.env.RAZORPAY_KEY_ID = live;
    process.env.RAZORPAY_KEY_SECRET = "not-a-real-secret";
    delete process.env.ALLOW_LIVE_PAYMENTS;
    expect(() => createCheckoutOrder({ amount: 100, currency: "INR", receipt: "receipt" })).toThrow(/Live payments/);
    process.env.ALLOW_LIVE_PAYMENTS = "true";
    const built = createCheckoutOrder({ amount: 100, currency: "INR", receipt: "receipt" });
    expect(built.request).toMatchObject({ amount: 10000, currency: "INR", receipt: "receipt", payment_capture: 1 });
    expect(built.providerRef.startsWith("shape_")).toBe(true);
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => createCheckoutOrder({ amount: 100, currency: "INR", receipt: "receipt" })).toThrow(/not configured/);
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.RAZORPAY_KEY_ID = live;
    const mockOrder = createCheckoutOrder({ amount: 100, currency: "INR", receipt: "receipt" });
    expect(mockOrder.providerRef.startsWith("pay_test_")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
