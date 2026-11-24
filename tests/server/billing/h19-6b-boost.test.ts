import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
import { PATCH as listingPatch, POST as listingPost } from "@/app/api/listings/[[...slug]]/route";
import { POST as promotionPost } from "@/app/api/promotions/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { Category, Listing, Location, MediaAsset, PromotionOrder, PromotionProduct, Session, Site, User } from "@/server/models";
import { randomToken } from "@/server/shared/crypto";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const attestations = { adult: true, accurate: true, rights: true };
const TOP_PRICE = 80;
const FEE = 30;

function call(handler: (request: Request) => Promise<Response>, url: string, method: string, body: unknown, cookie: string) {
  const headers = new Headers({ origin, cookie, "content-type": "application/json" });
  return handler(new Request(`${origin}${url}`, { method, headers, body: JSON.stringify(body) }));
}

async function account(email: string) {
  const token = randomToken();
  const user = await User.create({ email, passwordHash: "not-a-secret", displayName: "Ada", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01"), roles: ["user"], verificationStatus: "approved", status: "active" });
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}`, oid: user._id };
}

/** A ready draft (photo, phone, city) and a TOP plan that costs TOP_PRICE ad credits. */
async function readyDraft(user: Awaited<ReturnType<typeof account>>) {
  const category = await Category.create({ slug: "cycles", name: "Cycles", enabled: true, fields: [] });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
  const created = await call(listingPost, "/api/listings", "POST", { categoryId: category._id.toString(), cityId: city._id.toString(), title: "City cycle" }, user.cookie);
  const listingId = (await created.json()).data.id as string;
  const media = await MediaAsset.create({ ownerId: user.oid, listingId, kind: "image", objectKey: "listings/one", status: "cleared", clearedAt: new Date(), contentType: "image/jpeg" });
  await call(listingPatch, `/api/listings/${listingId}`, "PATCH", { stage: "details", contact: { phone: "9000000011", acceptForm: false } }, user.cookie);
  await call(listingPatch, `/api/listings/${listingId}`, "PATCH", { stage: "photos", mediaIds: [media._id.toString()] }, user.cookie);
  const top = await PromotionProduct.create({ code: "top", name: "TOP", description: "Top of the results", amount: TOP_PRICE, currency: "INR", durationDays: 1, enabled: true });
  return { listingId, productId: top._id.toString() };
}

const publish = (listingId: string, cookie: string) => call(listingPost, `/api/listings/${listingId}/submit`, "POST", { attestations }, cookie);
const boost = (listingId: string, productId: string, cookie: string, key = "boost-key-0001") => call(promotionPost, "/api/promotions", "POST", { listingId, productId, idempotencyKey: key }, cookie);

async function seed(user: Awaited<ReturnType<typeof account>>, credits: number) {
  if (credits > 0) await creditWallet({ userId: user.id, amount: credits, refType: "seed", refId: `seed-${credits}-${Math.random()}`, requestId: "seed", actorId: user.id });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.ALLOW_LIVE_PAYMENTS = "false";
  process.env.SESSION_SECRET = "session-secret";
  await connectMemoryMongo();
});
afterAll(async () => {
  for (const key of ["PAYMENT_PROVIDER", "ALLOW_LIVE_PAYMENTS", "SESSION_SECRET"]) delete process.env[key];
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  delete process.env.FREE_ADS_PER_WEEK;
});

describe("H19.6b Free, TOP and Super Top on the last step", () => {
  it("Free: publishing charges nothing and starts no boost", async () => {
    const user = await account("free@example.com");
    const { listingId } = await readyDraft(user);
    await seed(user, 200);
    expect((await publish(listingId, user.cookie)).status).toBe(200);
    expect(await walletBalance(user.id)).toBe(200);
    expect(await PromotionOrder.countDocuments({})).toBe(0);
  });

  it("TOP: the ad goes live free, then exactly the plan price is taken in ad credits and the boost is active at once", async () => {
    const user = await account("top@example.com");
    const { listingId, productId } = await readyDraft(user);
    await seed(user, 200);
    expect((await publish(listingId, user.cookie)).status).toBe(200);
    const bought = await boost(listingId, productId, user.cookie);
    expect(bought.status).toBe(200);
    expect((await bought.json()).data.balance).toBe(200 - TOP_PRICE);
    expect(await walletBalance(user.id)).toBe(200 - TOP_PRICE);
    const orders = await PromotionOrder.find({}).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("active");
    expect(String(orders[0].listingId)).toBe(listingId);
  });

  it("TOP on a paid-posting site: the posting fee and the plan are both taken, once each", async () => {
    await Site.updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: FEE, freeAdsPerAccount: 0 } }, { upsert: true, strict: false });
    const user = await account("paid@example.com");
    const { listingId, productId } = await readyDraft(user);
    await seed(user, 200);
    const published = await publish(listingId, user.cookie);
    expect(published.status).toBe(200);
    expect((await published.json()).data.charged).toBe(FEE);
    expect((await boost(listingId, productId, user.cookie)).status).toBe(200);
    expect(await walletBalance(user.id)).toBe(200 - FEE - TOP_PRICE);
    // A repeated click on the same boost is the same purchase, never a second one.
    expect((await boost(listingId, productId, user.cookie)).status).toBe(200);
    expect(await walletBalance(user.id)).toBe(200 - FEE - TOP_PRICE);
    expect(await PromotionOrder.countDocuments({})).toBe(1);
  });

  it("not enough ad credits: the server refuses the boost and takes nothing; after a recharge the same step goes through", async () => {
    const user = await account("short@example.com");
    const { listingId, productId } = await readyDraft(user);
    await seed(user, 50);
    expect((await publish(listingId, user.cookie)).status).toBe(200);
    const refused = await boost(listingId, productId, user.cookie, "boost-key-short");
    expect(refused.status).toBe(402);
    expect(await walletBalance(user.id)).toBe(50);
    expect(await PromotionOrder.countDocuments({})).toBe(0);
    // The recharge sheet adds credits (ad packs), then the publish carries on.
    await seed(user, 100);
    const retry = await boost(listingId, productId, user.cookie, "boost-key-after-recharge");
    expect(retry.status).toBe(200);
    expect(await walletBalance(user.id)).toBe(150 - TOP_PRICE);
    expect((await Listing.findById(listingId))?.status).toBe("active");
  });

  it("someone else's ad cannot be boosted with my credits", async () => {
    const owner = await account("owner@example.com");
    const other = await account("other@example.com");
    const { listingId, productId } = await readyDraft(owner);
    await seed(other, 300);
    expect((await publish(listingId, owner.cookie)).status).toBe(200);
    const res = await boost(listingId, productId, other.cookie, "boost-key-other");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await walletBalance(other.id)).toBe(300);
  });
});
