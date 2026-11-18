import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { undoWindowDays } from "@/server/admin/undo/registry";
import { setMoneySettings } from "@/server/billing/money-settings";
import { startRecharge } from "@/server/billing/recharge";
import { purchasePromotion } from "@/server/billing/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { submitListing } from "@/server/listings/service";
import { AuditEvent, Category, CreditPack, Listing, Site, User } from "@/server/models";
import { PAUSE_MESSAGES, readEmergency, setEmergencySwitch } from "@/server/settings/emergency";
import { readRawSite, readSettingsData, saveUndoWindows, setPostModeration } from "@/server/settings/settings-admin";
import { requestTour } from "@/server/tours/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctxOf = (roles: string[], n: number): AdminCtx => ({ actorId: `00000000000000000000006${n}`, email: `staff${n}@example.com`, roles, requestId: `req-${n}` });
const admin = ctxOf(["admin"], 1);
const trust = ctxOf(["trust_safety"], 3);
const support = ctxOf(["support"], 4);
const attest = { adult: true as const, accurate: true as const, rights: true as const };

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

async function member(createdAt?: Date) {
  const user = await User.create({ email: `m${Math.random().toString(36).slice(2, 8)}@example.com`, displayName: "Asha", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
  if (createdAt) await User.collection.updateOne({ _id: user._id }, { $set: { createdAt } });
  return user;
}

async function draftFor(userId: string) {
  const category = (await Category.findOne({ slug: "dating" })) ?? (await Category.create({ slug: "dating", name: "dating", enabled: true }));
  return Listing.create({ ownerId: userId, categoryId: category._id, title: "Coffee and a walk", description: "Looking to meet for coffee and a walk.", status: "draft", cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, attributes: { age: 28 } });
}

const OLD = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

describe("the switches", () => {
  it("are all off by default, change one at a time through adminWrite, and are audited", async () => {
    expect(await readEmergency()).toEqual({ holdNewAds: false, pauseNewAccounts24h: false, pausePaidPosting: false, pausePurchases: false, pauseVideoCalls: false });
    const done = await setEmergencySwitch(admin, { key: "pausePurchases", on: true });
    expect((await readEmergency()).pausePurchases).toBe(true);
    expect((await readEmergency()).holdNewAds).toBe(false);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "settings.emergency", targetType: "site", actorRole: "admin" });
    expect(done.undoUntil).not.toBeNull();
  });

  it("need the emergency permission, a known switch and a yes or no", async () => {
    await expect(setEmergencySwitch(support, { key: "holdNewAds", on: true })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
    await expect(setEmergencySwitch(admin, { key: "somethingElse", on: true })).rejects.toBeInstanceOf(ConflictError);
    await expect(setEmergencySwitch(admin, { key: "holdNewAds", on: "yes" })).rejects.toBeInstanceOf(ConflictError);
    await expect(setEmergencySwitch(trust, { key: "holdNewAds", on: true })).resolves.toBeTruthy();
    expect((await readEmergency()).holdNewAds).toBe(true);
  });

  it("Undo puts the switches back as they were", async () => {
    await setEmergencySwitch(admin, { key: "holdNewAds", on: true });
    const second = await setEmergencySwitch(admin, { key: "pauseVideoCalls", on: true });
    expect((await undoEvent(admin, second.eventId)).ok).toBe(true);
    expect(await readEmergency()).toMatchObject({ holdNewAds: true, pauseVideoCalls: false });
  });
});

describe("each switch blocks its own path with a clear message", () => {
  it("pause recharges stops a recharge and a promotion purchase", async () => {
    const user = await member(OLD);
    const pack = await CreditPack.create({ credits: 100, price: 1000, status: "active" });
    await setEmergencySwitch(admin, { key: "pausePurchases", on: true });
    await expect(startRecharge({ userId: String(user._id), packId: String(pack._id), method: "card", requestId: "r" })).rejects.toThrow(PAUSE_MESSAGES.pausePurchases);
    await expect(purchasePromotion({ userId: String(user._id), listingId: String(new mongoose.Types.ObjectId()), productId: String(new mongoose.Types.ObjectId()), requestId: "r" })).rejects.toThrow(PAUSE_MESSAGES.pausePurchases);
    await setEmergencySwitch(admin, { key: "pausePurchases", on: false });
    await expect(startRecharge({ userId: String(user._id), packId: String(pack._id), method: "card", requestId: "r" })).resolves.toBeTruthy();
  });

  it("pause video calls stops a new tour request", async () => {
    await setEmergencySwitch(admin, { key: "pauseVideoCalls", on: true });
    await expect(requestTour({ userId: String(new mongoose.Types.ObjectId()), listingId: String(new mongoose.Types.ObjectId()), requestId: "r", eventId: "e" } as never)).rejects.toThrow(PAUSE_MESSAGES.pauseVideoCalls);
  });

  it("pause accounts younger than 24 hours stops a new account and lets an older one post", async () => {
    const fresh = await member();
    const old = await member(OLD);
    await setEmergencySwitch(admin, { key: "pauseNewAccounts24h", on: true });
    await expect(submitListing((await draftFor(String(fresh._id))).id, String(fresh._id), attest, "r")).rejects.toThrow(PAUSE_MESSAGES.pauseNewAccounts24h);
    expect(await submitListing((await draftFor(String(old._id))).id, String(old._id), attest, "r")).toMatchObject({ status: "active" });
  });

  it("pause paid posting stops a new ad while paid posting is on, but not an edit of a live ad, and not free posting", async () => {
    const user = await member(OLD);
    const live = await draftFor(String(user._id));
    await submitListing(live.id, String(user._id), attest, "r");
    await setMoneySettings({ actorId: admin.actorId, roles: ["admin"], values: { paidPostingOn: true, postingFeeCredits: 0, freeAdsPerAccount: 0 }, requestId: "r" });
    await setEmergencySwitch(admin, { key: "pausePaidPosting", on: true });
    // Paid posting on but the fee is 0: nothing is charged, so nothing is paused.
    expect(await submitListing((await draftFor(String(user._id))).id, String(user._id), attest, "r")).toMatchObject({ status: "active" });
    await setMoneySettings({ actorId: admin.actorId, roles: ["admin"], values: { postingFeeCredits: 30 }, requestId: "r" });
    await expect(submitListing((await draftFor(String(user._id))).id, String(user._id), attest, "r")).rejects.toThrow(PAUSE_MESSAGES.pausePaidPosting);
    expect(await submitListing(live.id, String(user._id), attest, "r")).toMatchObject({ status: "active", charged: 0 });
  });

  it("hold every new ad sends the next ad to review instead of live, and not an edit of a live ad", async () => {
    const user = await member(OLD);
    const live = await draftFor(String(user._id));
    await submitListing(live.id, String(user._id), attest, "r");
    await setEmergencySwitch(admin, { key: "holdNewAds", on: true });
    const draft = await draftFor(String(user._id));
    expect(await submitListing(draft.id, String(user._id), attest, "r")).toMatchObject({ status: "pending" });
    const held = await Listing.findById(draft.id).lean();
    expect(held?.status).toBe("pending");
    expect(held?.publishedAt).toBeFalsy();
    expect(await submitListing(live.id, String(user._id), attest, "r")).toMatchObject({ status: "active" });
    await setEmergencySwitch(admin, { key: "holdNewAds", on: false });
    expect(await submitListing((await draftFor(String(user._id))).id, String(user._id), attest, "r")).toMatchObject({ status: "active" });
  });
});

describe("undo windows", () => {
  it("are saved as whole days 1 to 365, change how long an undo lasts, audited, and undoable", async () => {
    expect((await readSettingsData()).undoWindows).toEqual({ edits: 30, decisions: 7, credits: 7, demo: 7, settings: 30 });
    const done = await saveUndoWindows(admin, { edits: 60, decisions: "14", credits: 7, demo: 7, settings: 30 });
    expect((await readSettingsData()).undoWindows).toMatchObject({ edits: 60, decisions: 14 });
    expect(await undoWindowDays("edits")).toBe(60);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "settings.undo_windows" });
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await undoWindowDays("edits")).toBe(30);
  });

  it("refuse zero, too many, fractions, empty values and anyone but an admin", async () => {
    const ok = { edits: 30, decisions: 7, credits: 7, demo: 7, settings: 30 };
    for (const bad of [0, 366, 1.5, "", "abc", -3]) await expect(saveUndoWindows(admin, { ...ok, edits: bad })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveUndoWindows(support, ok)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveUndoWindows(trust, ok)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await undoWindowDays("edits")).toBe(30);
  });
});

describe("check ads after they go live", () => {
  it("turns on from now, off to nothing, and each step can be undone", async () => {
    expect((await readSettingsData()).postModerationSince).toBeNull();
    const on = await setPostModeration(admin, { on: true });
    expect(on.since).not.toBeNull();
    expect(Math.abs(new Date((await readSettingsData()).postModerationSince as string).getTime() - Date.now())).toBeLessThan(10_000);
    const off = await setPostModeration(admin, { on: false });
    expect((await readSettingsData()).postModerationSince).toBeNull();
    expect((await undoEvent(admin, off.eventId)).ok).toBe(true);
    expect((await readSettingsData()).postModerationSince).not.toBeNull();
    await expect(setPostModeration(support, { on: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setPostModeration(admin, { on: "yes" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("the raw site record", () => {
  it("is read only, for a superadmin only, and leaves out secret-looking keys", async () => {
    await Site.updateOne({ key: "default" }, { $set: { name: "Tharkoo" } }, { upsert: true });
    await Site.collection.updateOne({ key: "default" }, { $set: { apiKey: "should-not-show", token: "nope" } });
    const text = await readRawSite(["superadmin"]);
    expect(JSON.parse(text)).toMatchObject({ key: "default", name: "Tharkoo" });
    expect(text).not.toContain("should-not-show");
    await expect(readRawSite(["admin"])).rejects.toBeInstanceOf(ForbiddenError);
  });
});
