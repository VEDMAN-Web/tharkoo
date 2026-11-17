import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { validateCoupon } from "@/server/billing/coupons";
import { cleanCode, createCoupon, readCoupons, updateCoupon } from "@/server/billing/coupons-admin";
import { createPack, pricePerCredit, readPacks, updatePack } from "@/server/billing/packs-admin";
import { rechargePacks } from "@/server/billing/recharge";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Coupon, CreditPack } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000041", email: "admin@example.com", roles: ["admin"], requestId: "req-a" };
const finance: AdminCtx = { actorId: "000000000000000000000042", email: "fin@example.com", roles: ["finance"], requestId: "req-f" };

const PACK = { credits: 200, bonus: 10, price: 1900, tag: "Extra credits", shown: true };
const COUPON = { code: "welcome10", kind: "percent", amount: 10, startsAt: "", endsAt: "", maxRedemptions: "", perUserLimit: "1", on: true };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await Coupon.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("recharge packs", () => {
  it("works out the price of one credit with the free credits counted", () => {
    expect(pricePerCredit(1900, 200, 10)).toBe(9.05);
    expect(pricePerCredit(1000, 100, 0)).toBe(10);
    expect(pricePerCredit(27_500, 5000, 2250)).toBe(3.79);
    expect(pricePerCredit(100, 0, 0)).toBe(0);
  });

  it("adds a pack (audited), lists it smallest first with its price per credit, and refuses the same pack twice", async () => {
    await createPack(admin, { credits: 500, bonus: 75, price: 4250, tag: "Most popular", shown: true });
    const done = await createPack(admin, PACK);
    const packs = await readPacks();
    expect(packs.map((pack) => pack.total)).toEqual([210, 575]);
    expect(packs[0]).toMatchObject({ credits: 200, bonus: 10, price: 1900, perCredit: 9.05, tag: "Extra credits", shown: true });
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "pack.create", actorRole: "admin" });
    await expect(createPack(admin, PACK)).rejects.toBeInstanceOf(ConflictError);
  });

  it("a hidden pack disappears from what people can buy and comes back when shown; undo restores from the saved values", async () => {
    await createPack(admin, PACK);
    const id = (await readPacks())[0].id;
    expect((await rechargePacks()).map((pack) => pack.id)).toContain(id);
    const hidden = await updatePack(admin, { id, ...PACK, shown: false });
    expect((await rechargePacks()).map((pack) => pack.id)).not.toContain(id);
    expect((await readPacks())[0].shown).toBe(false);
    const row = await AuditEvent.findById(hidden.eventId).lean();
    expect(row).toMatchObject({ action: "pack.update", targetType: "credit_pack", targetId: id });
    const days = (new Date(hidden.undoUntil ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect((await undoEvent(admin, hidden.eventId)).ok).toBe(true);
    expect((await rechargePacks()).map((pack) => pack.id)).toContain(id);
    const priced = await updatePack(admin, { id, ...PACK, price: 2000 });
    expect((await rechargePacks()).find((pack) => pack.id === id)?.price).toBe(2000);
    expect((await undoEvent(admin, priced.eventId)).ok).toBe(true);
    expect((await rechargePacks()).find((pack) => pack.id === id)?.price).toBe(1900);
  });

  it("only admins can change packs, and the form is checked", async () => {
    await createPack(admin, PACK);
    const id = (await readPacks())[0].id;
    await expect(updatePack(finance, { id, ...PACK })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createPack(finance, { ...PACK, credits: 300 })).rejects.toBeInstanceOf(ForbiddenError);
    const bad = (patch: Record<string, unknown>) => expect(updatePack(admin, { id, ...PACK, ...patch })).rejects.toBeInstanceOf(ValidationError);
    await bad({ credits: 0 });
    await bad({ credits: 1.5 });
    await bad({ bonus: -1 });
    await bad({ price: 0 });
    await bad({ price: "abc" });
    await bad({ tag: "Free money" });
    await bad({ shown: "yes" });
    await expect(updatePack(admin, { id: "0123456789abcdef01234567", ...PACK })).rejects.toBeInstanceOf(NotFoundError);
    expect(await CreditPack.countDocuments({})).toBe(1);
  });
});

describe("coupons", () => {
  it("checks the code: format, capitals, and the blocked words", () => {
    expect(cleanCode(" welcome10 ")).toBe("WELCOME10");
    expect(cleanCode("a-b-c")).toBe("A-B-C");
    for (const bad of ["", "ab", "has space", "x".repeat(21), "-START", "emoji🙂code", "BLOCKEDWORD", "my-blockedword-1"]) expect(() => cleanCode(bad)).toThrow(ValidationError);
  });

  it("adds a coupon in capitals (audited), refuses the same code in any case, and refuses blocked words", async () => {
    const done = await createCoupon(admin, COUPON);
    const [row] = await readCoupons();
    expect(row).toMatchObject({ code: "WELCOME10", kind: "percent", amount: 10, perUserLimit: 1, maxRedemptions: null, on: true, redeemed: 0 });
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "coupon.create", actorRole: "admin" });
    await expect(createCoupon(admin, { ...COUPON, code: "Welcome10" })).rejects.toBeInstanceOf(ConflictError);
    await expect(createCoupon(admin, { ...COUPON, code: "blockedword1" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createCoupon(finance, { ...COUPON, code: "OTHER10" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await Coupon.countDocuments({})).toBe(1);
  });

  it("checks the offer, the dates and the limits", async () => {
    const bad = (patch: Record<string, unknown>) => expect(createCoupon(admin, { ...COUPON, code: "TRY1", ...patch })).rejects.toBeInstanceOf(ValidationError);
    await bad({ kind: "label" });
    await bad({ amount: 0 });
    await bad({ amount: 101 });
    await bad({ amount: 1.5 });
    await bad({ kind: "credits", amount: 100_001 });
    await bad({ startsAt: "not a date" });
    await bad({ startsAt: "2026-12-01T00:00:00+05:30", endsAt: "2026-11-01T23:59:59+05:30" });
    await bad({ maxRedemptions: "0" });
    await bad({ perUserLimit: "-2" });
    await bad({ on: "yes" });
    expect(await Coupon.countDocuments({})).toBe(0);
  });

  it("start and end dates, limits and the off switch decide whether people can use it", async () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    await createCoupon(admin, { ...COUPON, code: "LATER", startsAt: future });
    await createCoupon(admin, { ...COUPON, code: "OLDONE", endsAt: past });
    await createCoupon(admin, { ...COUPON, code: "NOWNOW", startsAt: past, endsAt: future, maxRedemptions: "5" });
    await createCoupon(admin, { ...COUPON, code: "SWITCHED", on: false });
    const user = String(new mongoose.Types.ObjectId());
    await expect(validateCoupon("later", user)).rejects.toThrow(/not active yet/);
    await expect(validateCoupon("oldone", user)).rejects.toThrow(/expired/);
    await expect(validateCoupon("switched", user)).rejects.toThrow(/invalid/i);
    await expect(validateCoupon("nownow", user)).resolves.toMatchObject({ code: "NOWNOW" });
  });

  it("an edit of an existing coupon is audited and can be undone for 30 days; the code cannot change", async () => {
    await createCoupon(admin, COUPON);
    const id = (await readCoupons())[0].id;
    const edit = { id, kind: "credits", amount: 25, startsAt: "2026-12-01T00:00:00+05:30", endsAt: "2026-12-31T23:59:59+05:30", maxRedemptions: "100", perUserLimit: "2", on: true };
    const done = await updateCoupon(admin, edit);
    expect(await readCoupons()).toMatchObject([{ code: "WELCOME10", kind: "credits", amount: 25, maxRedemptions: 100, perUserLimit: 2 }]);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "coupon.update", targetType: "coupon", targetId: id });
    const days = (new Date(done.undoUntil ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect((await undoEvent(admin, done.eventId)).ok).toBe(true);
    expect(await readCoupons()).toMatchObject([{ code: "WELCOME10", kind: "percent", amount: 10, startsAt: null, endsAt: null, maxRedemptions: null, perUserLimit: 1 }]);
    await expect(updateCoupon(finance, edit)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an old text-only coupon is listed but cannot be edited here", async () => {
    const old = await Coupon.create({ code: "OLDTEXT", label: "10% off", value: "10%", status: "active", kind: "label" });
    expect((await readCoupons())[0]).toMatchObject({ code: "OLDTEXT", kind: "label" });
    await expect(updateCoupon(admin, { id: String(old._id), kind: "percent", amount: 5, startsAt: "", endsAt: "", maxRedemptions: "", perUserLimit: "", on: true })).rejects.toBeInstanceOf(ConflictError);
  });
});
