import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as walletGet } from "@/app/api/wallet/[[...slug]]/route";
import { POST as listingsPost } from "@/app/api/listings/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { MONEY_DEFAULTS, readMoneySettings, setMoneySettings } from "@/server/billing/money-settings";
import { InsufficientCreditsError, chargePostingFee, isPostingFeePaid, postingFeeStatus, refundPostingFee } from "@/server/billing/posting-fee";
import { rejectListing } from "@/server/moderation/decide";
import { submitListing } from "@/server/listings/service";
import { AuditEvent, Category, Listing, Session, User, WalletEntry } from "@/server/models";
import { ensureWalletRefKeyIndex } from "../../../scripts/ensure-wallet-index.mjs";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { actorId: "000000000000000000000001", roles: ["admin"], requestId: "req" };
const attest = { adult: true as const, accurate: true as const, rights: true as const };
const origin = "http://127.0.0.1:4317";

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

async function member() {
  return User.create({
    email: `member${Math.random().toString(36).slice(2, 8)}@example.com`,
    displayName: "Asha",
    passwordHash: "x",
    status: "active",
    roles: ["user"],
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    verificationStatus: "approved",
  });
}

async function draftFor(userId: string, slug = "dating") {
  const category = (await Category.findOne({ slug })) ?? (await Category.create({ slug, name: slug, enabled: true }));
  return Listing.create({
    ownerId: userId,
    categoryId: category._id,
    title: "Coffee and a walk",
    description: "Looking to meet for coffee and a walk.",
    status: "draft",
    cityId: new mongoose.Types.ObjectId(),
    contact: { phone: "9876543210" },
  });
}

async function fee(value: number) {
  await setMoneySettings({ ...admin, values: { postingFeeCredits: value, paidPostingOn: true } });
}

async function topUp(userId: string, amount: number, ref = "topup-1") {
  await creditWallet({ userId, amount, refType: "test_topup", refId: ref, requestId: "r", actorType: "system" });
}

describe("money settings", () => {
  it("default to a 30 credit fee, Rs 10 per credit, mock payments on and paid posting OFF", async () => {
    expect(MONEY_DEFAULTS).toEqual({ postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, paidPostingOn: false });
    expect(await readMoneySettings()).toEqual({ postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, paidPostingOn: false });
  });

  it("are for admins only, validate the numbers and write an audit row", async () => {
    await expect(setMoneySettings({ ...admin, roles: ["support"], values: { postingFeeCredits: 5 } })).rejects.toThrow(/admin/i);
    await expect(setMoneySettings({ ...admin, values: { postingFeeCredits: -1 } })).rejects.toThrow();
    await expect(setMoneySettings({ ...admin, values: { somethingElse: 1 } })).rejects.toThrow();
    const after = await setMoneySettings({ ...admin, values: { postingFeeCredits: 40, creditPriceInr: 12, mockPaymentsOn: false, paidPostingOn: true } });
    expect(after).toEqual({ postingFeeCredits: 40, creditPriceInr: 12, mockPaymentsOn: false, paidPostingOn: true });
    const rows = await AuditEvent.find({ action: "settings.money.update" }).lean();
    expect(rows).toHaveLength(1);
  });
});

describe("paid posting OFF (the default)", () => {
  it("answers fee 0 and never charges, even with a fee saved", async () => {
    await setMoneySettings({ ...admin, values: { postingFeeCredits: 30 } });
    const user = await member();
    const draft = await draftFor(user.id);
    expect(await postingFeeStatus(user.id)).toMatchObject({ fee: 0, balance: 0, short: 0, enough: true });
    expect(await submitListing(draft.id, user.id, attest, "r")).toMatchObject({ status: "active", charged: 0, balance: 0 });
    expect(await WalletEntry.countDocuments({})).toBe(0);
  });

  it("starts charging when the admin turns it on", async () => {
    await setMoneySettings({ ...admin, values: { postingFeeCredits: 30 } });
    await setMoneySettings({ ...admin, values: { paidPostingOn: true } });
    const user = await member();
    await topUp(user.id, 50);
    expect(await postingFeeStatus(user.id)).toMatchObject({ fee: 30, balance: 50, after: 20, enough: true });
    const draft = await draftFor(user.id);
    expect(await submitListing(draft.id, user.id, attest, "r")).toMatchObject({ charged: 30, balance: 20 });
  });
});

describe("the posting fee at publish", () => {
  it("is charged once, even when the ad is published again", async () => {
    await fee(30);
    const user = await member();
    await topUp(user.id, 100);
    const draft = await draftFor(user.id);
    const first = await submitListing(draft.id, user.id, attest, "r1");
    expect(first).toMatchObject({ status: "active", charged: 30, balance: 70 });
    await Listing.updateOne({ _id: draft._id }, { $set: { status: "paused" } });
    const again = await submitListing(draft.id, user.id, attest, "r2");
    expect(again.charged).toBe(0);
    expect(await walletBalance(user.id)).toBe(70);
    expect(await WalletEntry.countDocuments({ userId: user.id, refType: "listing_fee" })).toBe(1);
    expect(await isPostingFeePaid(draft.id)).toBe(true);
  });

  it("is charged once when two requests arrive together, 50 times in a row", async () => {
    await WalletEntry.init();
    await fee(30);
    const user = await member();
    await topUp(user.id, 3000);
    let expected = 3000;
    for (let round = 0; round < 50; round += 1) {
      const draft = await draftFor(user.id);
      const results = await Promise.all([
        chargePostingFee({ userId: user.id, listingId: draft.id, requestId: `a${round}` }),
        chargePostingFee({ userId: user.id, listingId: draft.id, requestId: `b${round}` }),
      ]);
      expect(results.map((row) => row.charged).sort((x, y) => x - y), `round ${round}`).toEqual([0, 30]);
      expected -= 30;
      expect(await WalletEntry.countDocuments({ userId: user.id, refType: "listing_fee", refId: new RegExp(`^${draft.id}:`) }), `round ${round}`).toBe(1);
    }
    expect(await walletBalance(user.id)).toBe(expected);
  });

  it("returns the fee once even when two refunds arrive together", async () => {
    await WalletEntry.init();
    await fee(30);
    const user = await member();
    await topUp(user.id, 100);
    for (let round = 0; round < 20; round += 1) {
      const draft = await draftFor(user.id);
      await chargePostingFee({ userId: user.id, listingId: draft.id, requestId: "c" });
      const refunds = await Promise.all([
        refundPostingFee({ userId: user.id, listingId: draft.id, requestId: "r1" }),
        refundPostingFee({ userId: user.id, listingId: draft.id, requestId: "r2" }),
      ]);
      expect(refunds.sort((x, y) => x - y), `round ${round}`).toEqual([0, 30]);
      expect(await WalletEntry.countDocuments({ refType: "listing_fee_refund", refId: new RegExp(`^${draft.id}:`) })).toBe(1);
    }
    expect(await walletBalance(user.id)).toBe(100);
  });

  it("blocks a publish without enough credits, charges nothing and leaves the draft", async () => {
    await fee(30);
    const user = await member();
    await topUp(user.id, 12);
    const draft = await draftFor(user.id);
    const error = await submitListing(draft.id, user.id, attest, "r").catch((e: Error) => e);
    expect(error).toBeInstanceOf(InsufficientCreditsError);
    expect(error).toMatchObject({ need: 30, balance: 12, fee: 30, short: 18 });
    expect(await walletBalance(user.id)).toBe(12);
    expect((await Listing.findById(draft._id))?.status).toBe("draft");
    expect(await WalletEntry.countDocuments({ refType: "listing_fee" })).toBe(0);
  });

  it("costs nothing while the fee is 0", async () => {
    await fee(0);
    const user = await member();
    const draft = await draftFor(user.id);
    expect(await submitListing(draft.id, user.id, attest, "r")).toMatchObject({ status: "active", charged: 0 });
    expect(await WalletEntry.countDocuments({})).toBe(0);
  });

  it("returns the fee when moderation rejects the ad, once, and charges again on a new publish", async () => {
    await fee(30);
    const user = await member();
    await topUp(user.id, 100);
    const draft = await draftFor(user.id);
    await submitListing(draft.id, user.id, attest, "r");
    expect(await walletBalance(user.id)).toBe(70);
    await Listing.updateOne({ _id: draft._id }, { $set: { status: "pending" } });
    const rejected = await rejectListing({ id: draft.id, roles: ["moderator"], email: "mod@example.com", reason: "Not allowed" });
    expect(rejected).toMatchObject({ status: "rejected", refunded: 30 });
    expect(await walletBalance(user.id)).toBe(100);
    const refund = await WalletEntry.findOne({ refType: "listing_fee_refund" }).lean();
    expect(refund).toMatchObject({ delta: 30, reason: "refund" });
    expect(await isPostingFeePaid(draft.id)).toBe(false);
    await Listing.updateOne({ _id: draft._id }, { $set: { status: "draft" } });
    expect(await submitListing(draft.id, user.id, attest, "r3")).toMatchObject({ charged: 30, balance: 70 });
  });

  it("returns the fee once when two moderators reject the same ad at the same moment", async () => {
    await WalletEntry.init();
    await fee(30);
    const user = await member();
    await topUp(user.id, 300);
    for (let round = 0; round < 10; round += 1) {
      const draft = await draftFor(user.id);
      await submitListing(draft.id, user.id, attest, `s${round}`);
      await Listing.updateOne({ _id: draft._id }, { $set: { status: "pending" } });
      const results = await Promise.allSettled([
        rejectListing({ id: draft.id, roles: ["moderator"], email: "a@example.com", reason: "No" }),
        rejectListing({ id: draft.id, roles: ["moderator"], email: "b@example.com", reason: "No" }),
      ]);
      expect(results.some((row) => row.status === "fulfilled"), `round ${round}`).toBe(true);
      expect(await WalletEntry.countDocuments({ refType: "listing_fee_refund", refId: new RegExp(`^${draft.id}:`) }), `round ${round}`).toBe(1);
    }
    expect(await walletBalance(user.id)).toBe(300);
  });

  it("does not apply the weekly free limit while a fee is on", async () => {
    await fee(1);
    const user = await member();
    await topUp(user.id, 50);
    for (let index = 0; index < 5; index += 1) {
      const draft = await draftFor(user.id);
      expect((await submitListing(draft.id, user.id, attest, `r${index}`)).status).toBe("active");
    }
    expect(await walletBalance(user.id)).toBe(45);
  });
});

describe("the routes", () => {
  async function signedIn() {
    const user = await member();
    await Session.create({ userId: user._id, tokenHash: hashToken("tok-fee"), expiresAt: new Date(Date.now() + 86_400_000) });
    return { user, cookie: "sid=tok-fee" };
  }

  it("answers the fee, balance and shortfall for the post page", async () => {
    await fee(30);
    const { user, cookie } = await signedIn();
    await topUp(user.id, 12);
    const res = await walletGet(new Request(`${origin}/api/wallet/posting-fee`, { headers: { origin, cookie } }));
    const body = (await res.json()) as { ok: boolean; data: Record<string, unknown> };
    expect(body.data).toEqual({ fee: 30, balance: 12, after: 0, short: 18, enough: false, creditPriceInr: 10, mockPaymentsOn: true });
    expect(await postingFeeStatus(user.id)).toEqual(body.data);
  });

  it("answers 402 INSUFFICIENT_CREDITS with need and balance, in a plain sentence", async () => {
    await fee(30);
    const { user, cookie } = await signedIn();
    await topUp(user.id, 12);
    const draft = await draftFor(user.id);
    const res = await listingsPost(
      new Request(`${origin}/api/listings/${draft.id}/submit`, {
        method: "POST",
        headers: { origin, cookie, "content-type": "application/json" },
        body: JSON.stringify({ attestations: attest }),
      }),
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { ok: boolean; error: Record<string, unknown> };
    expect(body.error).toEqual({ code: "INSUFFICIENT_CREDITS", message: "You need 18 more credits to publish.", need: 30, balance: 12, fee: 30, short: 18 });
  });
});

describe("the wallet index script", () => {
  it("lists the indexes without writing, and builds the unique refKey index only with apply", async () => {
    const db = mongoose.connection.db!;
    await db.collection("wallet_entries").dropIndex("refKey_1").catch(() => undefined);
    const dry = await ensureWalletRefKeyIndex(db, { apply: false });
    expect(dry).toMatchObject({ apply: false, present: false, created: false });
    expect(dry.indexes).not.toContain("refKey_1");
    const built = await ensureWalletRefKeyIndex(db, { apply: true });
    expect(built).toMatchObject({ present: false, created: true });
    expect(built.indexes).toContain("refKey_1");
    const again = await ensureWalletRefKeyIndex(db, { apply: true });
    expect(again).toMatchObject({ present: true, created: false });
    const indexes = await db.collection("wallet_entries").indexes();
    expect(indexes.find((index) => index.name === "refKey_1")).toMatchObject({ unique: true });
  });
});
