import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { setExtraFreeAds } from "@/server/admin/user-free-ads";
import { undoEvent } from "@/server/admin/undo/core";
import { extendedAdEnd } from "@/server/billing/boost-window";
import { postingPlanFor, postingPlanOf } from "@/server/billing/free-ads";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { MONEY_DEFAULTS, readMoneySettings, saveMoneyValues } from "@/server/billing/money-settings";
import { postingFeeStatus } from "@/server/billing/posting-fee";
import { readPriceList } from "@/server/billing/price-list";
import { purchasePromotion } from "@/server/billing/service";
import { submitListing } from "@/server/listings/service";
import { ForbiddenError, ValidationError } from "@/server/http";
import { enoughFor } from "@/lib/price-list";
import { AuditEvent, Category, Listing, PromotionProduct, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles: ["admin"], requestId: "r" };
const support: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "sup@example.test", roles: ["support"], requestId: "r2" };
const attest = { adult: true as const, accurate: true as const, rights: true as const };
const HOUR = 3_600_000;

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

async function category() {
  return (await Category.findOne({ slug: "goods" })) ?? Category.create({ slug: "goods", name: "Goods", enabled: true, kind: "goods" });
}

async function draftFor(userId: string) {
  const cat = await category();
  return Listing.create({
    ownerId: userId,
    categoryId: cat._id,
    title: "A wooden desk",
    description: "A wooden desk in good condition.",
    status: "draft",
    cityId: new mongoose.Types.ObjectId(),
    contact: { phone: "9876543210" },
  });
}

async function published(userId: string, count: number) {
  const cat = await category();
  for (let index = 0; index < count; index += 1) {
    await Listing.create({ ownerId: userId, categoryId: cat._id, title: `Live ad ${index}`, description: "A description that is long enough.", slug: `live-${userId}-${index}`, status: "active", publishedAt: new Date() });
  }
}

const paid = (extra: Record<string, unknown> = {}) => saveMoneyValues(admin, { paidPostingOn: true, postingFeeCredits: 20, ...extra });

describe("H11.1 the free-ads rule (pure)", () => {
  const base = { allowance: 3, paidPostingOn: true, postingFeeCredits: 20 };

  it("ads 1, 2 and 3 are free, ad 4 and later cost the posting fee", () => {
    expect(postingPlanFor({ ...base, published: 0 })).toMatchObject({ free: true, fee: 0, adNumber: 1, freeLeft: 3 });
    expect(postingPlanFor({ ...base, published: 2 })).toMatchObject({ free: true, fee: 0, adNumber: 3, freeLeft: 1 });
    expect(postingPlanFor({ ...base, published: 3 })).toMatchObject({ free: false, fee: 20, adNumber: 4, freeLeft: 0 });
    expect(postingPlanFor({ ...base, published: 9 })).toMatchObject({ free: false, fee: 20, adNumber: 10 });
  });

  it("extra free ads add to the allowance, and with paid posting off everything is free", () => {
    expect(postingPlanFor({ ...base, allowance: 5, published: 4 })).toMatchObject({ free: true, fee: 0 });
    expect(postingPlanFor({ ...base, allowance: 5, published: 5 })).toMatchObject({ free: false, fee: 20 });
    expect(postingPlanFor({ ...base, paidPostingOn: false, published: 50 })).toMatchObject({ free: true, fee: 0 });
    expect(postingPlanFor({ ...base, allowance: 0, published: 0 })).toMatchObject({ free: false, fee: 20 });
  });
});

describe("H11.1 the free-ads rule at publish", () => {
  it("counts published ads, not drafts or ads refused before going live; the first 3 are free and the 4th is charged", async () => {
    await paid();
    const user = await member();
    const cat = await category();
    await Listing.create({ ownerId: user.id, categoryId: cat._id, title: "Never live", description: "A description that is long enough.", slug: "never-live", status: "rejected" });
    await Listing.create({ ownerId: user.id, categoryId: cat._id, title: "Just a draft", description: "A description that is long enough.", slug: "just-a-draft", status: "draft" });
    expect(await postingPlanOf(user.id)).toMatchObject({ adNumber: 1, free: true, freeLeft: 3 });
    for (let index = 0; index < 3; index += 1) {
      const draft = await draftFor(user.id);
      expect(await submitListing(draft.id, user.id, attest, `r${index}`)).toMatchObject({ status: "active", charged: 0 });
    }
    expect(await postingFeeStatus(user.id)).toMatchObject({ fee: 20, free: false, adNumber: 4, freeLeft: 0, freeAds: 3 });
    const fourth = await draftFor(user.id);
    await expect(submitListing(fourth.id, user.id, attest, "r4")).rejects.toThrow();
    await creditWallet({ userId: user.id, amount: 50, refType: "test_topup", refId: "t1", requestId: "r", actorType: "system" });
    expect(await submitListing(fourth.id, user.id, attest, "r5")).toMatchObject({ status: "active", charged: 20, balance: 30 });
    // Editing the live ad stays free.
    expect(await submitListing(fourth.id, user.id, attest, "r6")).toMatchObject({ charged: 0, balance: 30 });
  });

  it("the weekly free limit does not apply while paid posting is on, and applies when it is off", async () => {
    await paid({ freeAdsPerAccount: 5 });
    const user = await member();
    for (let index = 0; index < 4; index += 1) {
      const draft = await draftFor(user.id);
      expect(await submitListing(draft.id, user.id, attest, `w${index}`)).toMatchObject({ charged: 0 });
    }
    await saveMoneyValues(admin, { paidPostingOn: false });
    const other = await member();
    for (let index = 0; index < 3; index += 1) await submitListing((await draftFor(other.id)).id, other.id, attest, `o${index}`);
    await expect(submitListing((await draftFor(other.id)).id, other.id, attest, "o3")).rejects.toThrow(/limit/i);
  });

  it("extra free ads for one person: admin only, audited, one Undo, and it moves that person's free ads", async () => {
    await paid();
    const user = await member();
    const other = await member();
    await published(user.id, 3);
    await published(other.id, 3);
    expect(await postingPlanOf(user.id)).toMatchObject({ free: false, fee: 20 });
    await expect(setExtraFreeAds(support, { userId: user.id, extra: 2 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setExtraFreeAds(admin, { userId: user.id, extra: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(setExtraFreeAds(admin, { userId: user.id, extra: 1.5 })).rejects.toBeInstanceOf(ValidationError);
    const done = await setExtraFreeAds(admin, { userId: user.id, extra: 2 });
    expect(done.extra).toBe(2);
    expect(await postingPlanOf(user.id)).toMatchObject({ free: true, fee: 0, freeLeft: 2, allowance: 5 });
    expect(await postingPlanOf(other.id)).toMatchObject({ free: false, fee: 20 });
    expect(await AuditEvent.countDocuments({ action: "user.extra_free_ads" })).toBe(1);
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    expect(await postingPlanOf(user.id)).toMatchObject({ free: false, fee: 20 });
    expect((await User.findById(user.id).lean())?.extraFreeAds ?? null).toBeNull();
  });

  it("the setting Free ads for each account defaults to 3, is admin only, audited and can be undone", async () => {
    expect(MONEY_DEFAULTS.freeAdsPerAccount).toBe(3);
    expect((await readMoneySettings()).freeAdsPerAccount).toBe(3);
    await expect(saveMoneyValues(support, { freeAdsPerAccount: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveMoneyValues(admin, { freeAdsPerAccount: -1 })).rejects.toBeInstanceOf(ValidationError);
    const saved = await saveMoneyValues(admin, { freeAdsPerAccount: 1 });
    expect(saved.settings.freeAdsPerAccount).toBe(1);
    expect(await undoEvent(admin, saved.eventId)).toMatchObject({ ok: true });
    expect((await readMoneySettings()).freeAdsPerAccount).toBe(3);
  });
});

describe("H11.1 plans of 72 hours that extend the ad, and the price list", () => {
  async function plan(code: string, name: string, amount: number, hours: number) {
    return PromotionProduct.create({ code, name, description: `${name} plan`, amount, currency: "CRD", durationDays: Math.ceil(hours / 24), durationHours: hours, enabled: true });
  }

  it("moves the ad's end only when the plan ends after it", () => {
    const adEnd = new Date(Date.UTC(2026, 10, 20, 12));
    expect(extendedAdEnd(new Date(adEnd.getTime() + HOUR), adEnd)?.getTime()).toBe(adEnd.getTime() + HOUR);
    expect(extendedAdEnd(new Date(adEnd.getTime() - HOUR), adEnd)).toBeNull();
    expect(extendedAdEnd(adEnd, adEnd)).toBeNull();
    expect(extendedAdEnd(adEnd, null)).toBeNull();
  });

  it("buying a 72 hour plan for an ad that ends in 10 hours moves the ad's end to the plan's end, and audits it", async () => {
    const top = await plan("top", "TOP", 45, 72);
    const user = await member();
    const cat = await category();
    const endsIn10 = new Date(Date.now() + 10 * HOUR);
    const ad = await Listing.create({ ownerId: user.id, categoryId: cat._id, title: "Desk", description: "A description that is long enough.", slug: "desk-72", status: "active", publishedAt: new Date(), expiresAt: endsIn10 });
    await creditWallet({ userId: user.id, amount: 100, refType: "test_topup", refId: "t2", requestId: "r", actorType: "system" });
    await purchasePromotion({ userId: user.id, listingId: ad.id, productId: top.id, requestId: "r" });
    const after = await Listing.findById(ad.id).lean();
    expect(Math.abs(new Date(after?.expiresAt ?? 0).getTime() - (Date.now() + 72 * HOUR))).toBeLessThan(10_000);
    expect(await walletBalance(user.id)).toBe(55);
    const event = await AuditEvent.findOne({ action: "listing.extend_for_plan" }).lean();
    expect(event?.targetId).toBe(ad.id);
  });

  it("a plan that ends before the ad does leaves the ad's end alone", async () => {
    const top = await plan("top", "TOP", 45, 24);
    const user = await member();
    const cat = await category();
    const endsIn40 = new Date(Date.now() + 40 * HOUR);
    const ad = await Listing.create({ ownerId: user.id, categoryId: cat._id, title: "Desk", description: "A description that is long enough.", slug: "desk-24", status: "active", publishedAt: new Date(), expiresAt: endsIn40 });
    await creditWallet({ userId: user.id, amount: 100, refType: "test_topup", refId: "t3", requestId: "r", actorType: "system" });
    await purchasePromotion({ userId: user.id, listingId: ad.id, productId: top.id, requestId: "r" });
    expect(new Date((await Listing.findById(ad.id).lean())?.expiresAt ?? 0).getTime()).toBe(endsIn40.getTime());
    expect(await AuditEvent.countDocuments({ action: "listing.extend_for_plan" })).toBe(0);
  });

  it("the price list reads TOP and Super Top by their slugs, leaves out a missing or hidden plan, and counts free ads left", async () => {
    await paid();
    await plan("top", "TOP", 45, 72);
    await plan("super-top", "Super Top", 75, 72);
    const user = await member();
    await published(user.id, 1);
    const list = await readPriceList(user.id);
    expect(list).toMatchObject({ creditPriceInr: 10, adFee: 20, freeAds: 3, freeLeft: 2, top: { name: "TOP", credits: 45, hours: 72 }, superTop: { name: "Super Top", credits: 75, hours: 72 } });
    expect((await readPriceList()).freeLeft).toBeNull();
    await PromotionProduct.updateOne({ code: "super-top" }, { $set: { enabled: false } });
    await PromotionProduct.deleteOne({ code: "top" });
    expect(await readPriceList(user.id)).toMatchObject({ top: null, superTop: null });
  });

  it("works out what a pack buys, rounded down, and leaves out a plan that does not exist", () => {
    const list = { adFee: 20, top: { name: "TOP", credits: 45, hours: 72 }, superTop: { name: "Super Top", credits: 75, hours: 72 } };
    expect(enoughFor(210, list)).toEqual({ ads: 10, top: 4, superTop: 2 });
    expect(enoughFor(100, list)).toEqual({ ads: 5, top: 2, superTop: 1 });
    expect(enoughFor(7250 + 2250, list)).toEqual({ ads: 475, top: 211, superTop: 126 });
    expect(enoughFor(210, { adFee: 20, top: null, superTop: null })).toEqual({ ads: 10, top: null, superTop: null });
    expect(enoughFor(210, { adFee: 0, top: null, superTop: list.superTop })).toEqual({ ads: null, top: null, superTop: 2 });
  });
});
