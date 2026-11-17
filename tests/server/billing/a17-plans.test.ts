import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { promotionRule } from "@/server/billing/catalog";
import { readMoneySettings, saveMoneyValues, setMoneySettings } from "@/server/billing/money-settings";
import { createPlan, movePlan, readPricesData, testCreditsFigure, updatePlan } from "@/server/billing/plans-admin";
import { listProducts } from "@/server/billing/service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Payment, PromotionProduct, Site } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000031", email: "admin@example.com", roles: ["admin"], requestId: "req-a" };
const finance: AdminCtx = { actorId: "000000000000000000000032", email: "fin@example.com", roles: ["finance"], requestId: "req-f" };
const support: AdminCtx = { actorId: "000000000000000000000033", email: "sup@example.com", roles: ["support"], requestId: "req-s" };

const PLAN = { name: "Bump", description: "Moves the ad up", amount: 49, durationHours: 24, shown: true };

async function seed() {
  const bump = await PromotionProduct.create({ code: "bump", name: "Bump", description: "Moves the ad up", amount: 49, currency: "INR", durationDays: 1 });
  const top = await PromotionProduct.create({ code: "top", name: "TOP", description: "Top of results", amount: 499, currency: "INR", durationDays: 7 });
  const flash = await PromotionProduct.create({ code: "flash", name: "Flash", description: "Short flash", amount: 149, currency: "INR", durationDays: 1 });
  return { bump: String(bump._id), top: String(top._id), flash: String(flash._id) };
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
});

describe("money settings", () => {
  it("an admin saves the fee and price, it is audited, and the undo (30 days) restores only the saved values", async () => {
    const done = await saveMoneyValues(admin, { postingFeeCredits: 40, creditPriceInr: 12 });
    expect(done.settings).toMatchObject({ postingFeeCredits: 40, creditPriceInr: 12 });
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "settings.money.update", targetType: "site", actorRole: "admin" });
    expect(row?.undo?.kind).toBe("record.restore");
    const days = (new Date(done.undoUntil ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);

    const second = await saveMoneyValues(admin, { postingFeeCredits: 55 });
    expect((await readMoneySettings()).postingFeeCredits).toBe(55);
    expect((await undoEvent(admin, second.eventId)).ok).toBe(true);
    expect(await readMoneySettings()).toMatchObject({ postingFeeCredits: 40, creditPriceInr: 12 });
    // The first change can still be undone because the values it set are what they are now; that goes back to the defaults.
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await readMoneySettings()).toMatchObject({ postingFeeCredits: 30, creditPriceInr: 10 });
  });

  it("undo of a first-ever setting removes it, so the default shows again; a changed value since refuses the undo", async () => {
    const first = await saveMoneyValues(admin, { paidPostingOn: true });
    expect((await readMoneySettings()).paidPostingOn).toBe(true);
    await saveMoneyValues(admin, { paidPostingOn: false });
    expect(await undoEvent(admin, first.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    expect((await readMoneySettings()).paidPostingOn).toBe(false);
  });

  it("only admins can change it; finance and support are refused and the refusal is audited", async () => {
    await expect(saveMoneyValues(finance, { postingFeeCredits: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveMoneyValues(support, { postingFeeCredits: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(2);
    await expect(saveMoneyValues(admin, { postingFeeCredits: -1 })).rejects.toThrow();
    await expect(saveMoneyValues(admin, { somethingElse: 1 })).rejects.toThrow();
    expect(await readMoneySettings()).toMatchObject({ postingFeeCredits: 30 });
  });

  it("setMoneySettings still works for callers that only have an actor id", async () => {
    const after = await setMoneySettings({ actorId: admin.actorId, roles: ["admin"], values: { creditPriceInr: 9 }, requestId: "r" });
    expect(after.creditPriceInr).toBe(9);
    await expect(setMoneySettings({ actorId: admin.actorId, roles: ["support"], values: { creditPriceInr: 8 }, requestId: "r" })).rejects.toThrow();
  });
});

describe("promotion plans", () => {
  it("changing the Bump price is audited, shows in what buyers see, and can be undone for 30 days", async () => {
    const ids = await seed();
    const done = await updatePlan(admin, { id: ids.bump, ...PLAN, amount: 59 });
    expect((await PromotionProduct.findById(ids.bump).lean())?.amount).toBe(59);
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "plan.update", targetType: "promotion_plan", targetId: ids.bump, actorRole: "admin" });
    expect(row?.before).toMatchObject({ amount: 49 });
    expect(row?.after).toMatchObject({ amount: 59 });
    expect((await listProducts()).products.find((item) => item.code === "bump")?.amount).toBe(59);
    const days = (new Date(done.undoUntil ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect((await PromotionProduct.findById(ids.bump).lean())?.amount).toBe(49);
    expect((await listProducts()).products.find((item) => item.code === "bump")?.amount).toBe(49);
  });

  it("hiding a plan removes it from what buyers see, and the undo shows it again", async () => {
    const ids = await seed();
    const done = await updatePlan(admin, { id: ids.top, name: "TOP", description: "Top of results", amount: 499, durationHours: 24, shown: false });
    expect((await listProducts()).products.map((item) => item.code)).not.toContain("top");
    await undoEvent(admin, done.eventId);
    expect((await listProducts()).products.map((item) => item.code)).toContain("top");
  });

  it("checks the form: name, price, hours (1 to 48, never longer than an ad), blocked words, and keeps a fixed length for Flash", async () => {
    const ids = await seed();
    const bad = async (patch: Record<string, unknown>, id = ids.bump) => expect(updatePlan(admin, { id, ...PLAN, ...patch })).rejects.toBeInstanceOf(ValidationError);
    await bad({ name: "  " });
    await bad({ name: "x".repeat(41) });
    await bad({ description: "  " });
    await bad({ amount: -1 });
    await bad({ amount: 1.5 });
    await bad({ amount: 100_001 });
    await bad({ durationHours: 0 });
    await bad({ durationHours: 49 });
    await bad({ durationHours: 1.5 });
    await bad({ description: "a blockedword here" });
    await bad({ name: "<b>Bump</b>" });
    await bad({ shown: "yes" });
    const flash = await updatePlan(admin, { id: ids.flash, name: "Flash", description: "Short flash", amount: 150, durationHours: 99, shown: true });
    expect(flash.eventId).not.toBe("");
    expect((await PromotionProduct.findById(ids.flash).lean())?.durationDays).toBe(1);
    expect((await PromotionProduct.findById(ids.bump).lean())?.amount).toBe(49);
  });

  it("only admins can change a plan; a plan type that is not allowed cannot be edited; unknown ids are not found", async () => {
    const ids = await seed();
    await expect(updatePlan(finance, { id: ids.bump, ...PLAN, amount: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    const odd = await PromotionProduct.create({ code: "weird-type", name: "Weird", description: "Odd", amount: 5, currency: "INR", durationDays: 1 });
    await expect(updatePlan(admin, { id: String(odd._id), ...PLAN })).rejects.toBeInstanceOf(ConflictError);
    await expect(updatePlan(admin, { id: "0123456789abcdef01234567", ...PLAN })).rejects.toBeInstanceOf(NotFoundError);
    expect((await readPricesData()).plans.find((plan) => plan.code === "weird-type")?.allowed).toBe(false);
  });

  it("reorders with move up and down, shows that order to buyers, and one undo restores the old order", async () => {
    const ids = await seed();
    expect((await readPricesData()).plans.map((plan) => plan.code)).toEqual(["bump", "flash", "top"]);
    const moved = await movePlan(admin, { id: ids.top, direction: "up" });
    expect((await readPricesData()).plans.map((plan) => plan.code)).toEqual(["bump", "top", "flash"]);
    expect((await listProducts()).products.map((item) => item.code)).toEqual(["bump", "top", "flash"]);
    await expect(movePlan(admin, { id: ids.bump, direction: "up" })).rejects.toBeInstanceOf(ConflictError);
    await expect(movePlan(finance, { id: ids.top, direction: "up" })).rejects.toBeInstanceOf(ForbiddenError);
    const undone = await undoEvent(admin, moved.eventId);
    expect(undone, JSON.stringify(undone)).toMatchObject({ ok: true });
    expect((await readPricesData()).plans.map((plan) => plan.code)).toEqual(["bump", "flash", "top"]);
    expect((await Site.findOne({ key: "default" }).lean())?.planOrder ?? []).toEqual([]);
  });

  it("adds a plan of an allowed type that does not exist yet, hidden by default, and refuses a duplicate or a bad type", async () => {
    await seed();
    const done = await createPlan(admin, { code: "star", name: "Star", description: "Premium place", amount: 799, durationHours: 48, shown: false });
    expect(done.eventId).not.toBe("");
    expect((await readPricesData()).plans.find((plan) => plan.code === "star")).toMatchObject({ shown: false, amount: 799 });
    await expect(createPlan(admin, { code: "star", name: "Star", description: "", amount: 1, durationHours: 48, shown: false })).rejects.toBeInstanceOf(ConflictError);
    await expect(createPlan(admin, { code: "anything-else", name: "X", description: "", amount: 1, durationHours: 48, shown: false })).rejects.toBeInstanceOf(ValidationError);
    expect((await readPricesData()).freeCodes).not.toContain("star");
  });
});

describe("plans in hours (H7.168)", () => {
  it("saves a plan in hours, keeps whole hours for buyers, and a plan can never be longer than the ad's 48 hours", async () => {
    const ids = await seed();
    await updatePlan(admin, { id: ids.bump, ...PLAN, durationHours: 36 });
    const saved = await PromotionProduct.findById(ids.bump).lean();
    expect(saved).toMatchObject({ durationHours: 36, durationDays: 2 });
    const row = (await readPricesData()).plans.find((plan) => plan.code === "bump");
    expect(row).toMatchObject({ hours: 36, lasts: "36 hours", tooLong: false });
    const product = (await listProducts()).products.find((item) => item.code === "bump");
    expect(product).toMatchObject({ durationHours: 36 });
    expect(product?.schedule.durationMs).toBe(36 * 3_600_000);
    await expect(updatePlan(admin, { id: ids.bump, ...PLAN, durationHours: 49 })).rejects.toThrow(/1 to 48/);
    await expect(updatePlan(admin, { id: ids.bump, ...PLAN, durationHours: 72 })).rejects.toThrow(/cannot last longer than the ad/);
  });

  it("TOP is set in hours too, with no 1, 3 or 7 days, and boosts in proportion", async () => {
    const ids = await seed();
    await updatePlan(admin, { id: ids.top, name: "TOP", description: "Top of results", amount: 499, durationHours: 48, shown: true });
    const product = (await listProducts()).products.find((item) => item.code === "top");
    expect(product).toMatchObject({ durationHours: 48 });
    expect(product?.schedule.boosts).toBe(6);
    expect(promotionRule("top", undefined, 7, 12).boosts).toBe(2);
  });

  it("a plan saved in days before this change shows its real length in hours and is flagged when it is longer than an ad", async () => {
    await seed();
    const old = (await readPricesData()).plans.find((plan) => plan.code === "top");
    expect(old).toMatchObject({ hours: 168, lasts: "168 hours", tooLong: true, notOffered: false });
    expect((await readPricesData()).plans.find((plan) => plan.code === "bump")).toMatchObject({ notOffered: false });
    await PromotionProduct.create({ code: "free", name: "Free", description: "A standard listing with no promotion charge.", amount: 0, currency: "INR", durationDays: 1 });
    expect((await readPricesData()).plans.find((plan) => plan.code === "free")).toMatchObject({ notOffered: true });
    const flash = (await readPricesData()).plans.find((plan) => plan.code === "flash");
    expect(flash).toMatchObject({ hours: 4, lasts: "4 hours", tooLong: false });
  });
});

describe("the test credits figure", () => {
  it("counts credits added through test payments and the wallets that got them, never real payments", async () => {
    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();
    const base = { orderId: new mongoose.Types.ObjectId(), amount: 100, currency: "INR", status: "paid" as const };
    await Payment.create({ ...base, userId: user1, idempotencyKey: "k1", provider: "mock", credits: 100 });
    await Payment.create({ ...base, userId: user1, idempotencyKey: "k2", provider: "mock", credits: 50 });
    await Payment.create({ ...base, userId: user2, idempotencyKey: "k3", provider: "mock", credits: 10 });
    await Payment.create({ ...base, userId: user2, idempotencyKey: "k4", provider: "real", credits: 999 });
    await Payment.create({ ...base, userId: user2, idempotencyKey: "k5", provider: "mock", credits: 7, status: "pending" });
    expect(await testCreditsFigure()).toEqual({ credits: 160, wallets: 2 });
  });
});
