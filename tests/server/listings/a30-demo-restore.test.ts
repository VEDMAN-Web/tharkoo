import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError } from "@/server/http";
import { demoPanelData, endDemoAds, lastEndedDemoBatch, restoreDemoAds } from "@/server/listings/demo-ads";
import { AuditEvent, Category, Listing, Site, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const actorId = String(new mongoose.Types.ObjectId());
const admin = { actorId, roles: ["admin"], requestId: "req" };
const ctx = (roles: string[]): AdminCtx => ({ actorId, email: "s@example.test", roles, requestId: "r" });

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

async function ad(ownerId: string, slug: string, status: "active" | "expired" = "active", extra: Record<string, unknown> = {}) {
  const category = (await Category.findOne({ slug: "dating" })) ?? (await Category.create({ slug: "dating", name: "Dating", enabled: true }));
  return Listing.create({ ownerId, categoryId: category._id, title: `Ad ${slug}`, description: "A description that is long enough", slug, status, cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, ...extra });
}

async function world() {
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Seed", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
  const real = await User.create({ email: "real@example.com", displayName: "Real", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
  const a = await ad(seed.id, "demo-0001", "active", { homeShow: true });
  const b = await ad(seed.id, "demo-0002");
  const natural = await ad(seed.id, "demo-0003", "expired");
  const realAd = await ad(real.id, "in00012");
  return { a, b, natural, realAd };
}

const status = async (id: unknown) => (await Listing.findById(id).lean())?.status;

describe("ending the demo ads marks one batch", () => {
  it("puts the same batch id on every ended ad and on nothing else, and keeps it in the audit row", async () => {
    const w = await world();
    const done = await endDemoAds({ ...admin, confirm: "END 2" });
    expect(done.ended).toBe(2);
    const [a, b, natural, real] = await Promise.all([w.a, w.b, w.natural, w.realAd].map((row) => Listing.findById(row._id).lean()));
    expect(a?.demoEndedBatch).toBeTruthy();
    expect(a?.demoEndedBatch).toBe(b?.demoEndedBatch);
    expect(natural?.demoEndedBatch).toBeUndefined();
    expect(real?.demoEndedBatch).toBeUndefined();
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "listing.demo.end", undo: { kind: "demo.end" } });
    expect(row?.after).toMatchObject({ batch: a?.demoEndedBatch });
  });
});

describe("restoring", () => {
  it("is for a superadmin only, with a denial in the log, and changes nothing for others", async () => {
    const w = await world();
    await endDemoAds({ ...admin, confirm: "END 2" });
    await expect(restoreDemoAds(ctx(["admin"]))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(restoreDemoAds(ctx(["moderator"]))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await status(w.a._id)).toBe("expired");
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(2);
  });

  it("brings back only the ended batch, never an ad that expired by itself, and clears the batch", async () => {
    const w = await world();
    await endDemoAds({ ...admin, confirm: "END 2" });
    expect((await lastEndedDemoBatch())?.count).toBe(2);
    expect(await restoreDemoAds(ctx(["superadmin"]))).toEqual({ restored: 2 });
    expect(await status(w.a._id)).toBe("active");
    expect(await status(w.b._id)).toBe("active");
    expect(await status(w.natural._id)).toBe("expired");
    expect(await status(w.realAd._id)).toBe("active");
    expect((await Listing.findById(w.a._id).lean())?.demoEndedBatch).toBeUndefined();
    expect(await AuditEvent.findOne({ action: "listing.demo.restore" }).lean()).toMatchObject({ summary: "Brought back 2 demo ads" });
    await expect(restoreDemoAds(ctx(["superadmin"]))).rejects.toBeInstanceOf(ConflictError);
  });

  it("is refused when the days to bring them back are over", async () => {
    const w = await world();
    await Site.collection.insertOne({ key: "default", undoWindows: { demo: 0 } });
    await endDemoAds({ ...admin, confirm: "END 2" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await lastEndedDemoBatch()).toMatchObject({ count: 2, canRestore: false });
    await expect(restoreDemoAds(ctx(["superadmin"]))).rejects.toThrow(/days to bring/);
    expect(await status(w.a._id)).toBe("expired");
  });

  it("ignores an end that was undone and an old end that has nothing left", async () => {
    const w = await world();
    const done = await endDemoAds({ ...admin, confirm: "END 2" });
    expect(await undoEvent(ctx(["admin"]), done.eventId)).toMatchObject({ ok: true });
    expect(await lastEndedDemoBatch()).toBeNull();
    expect(await status(w.a._id)).toBe("active");
    expect(await status(w.natural._id)).toBe("expired");
  });
});

describe("undoing the end", () => {
  it("brings back the batch for an admin, refuses a role without the right, and says so when it is already done", async () => {
    const w = await world();
    const done = await endDemoAds({ ...admin, confirm: "END 2" });
    expect(await undoEvent(ctx(["moderator"]), done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(await status(w.a._id)).toBe("expired");
    expect(await undoEvent(ctx(["admin"]), done.eventId)).toMatchObject({ ok: true });
    expect([await status(w.a._id), await status(w.b._id), await status(w.natural._id)]).toEqual(["active", "active", "expired"]);
    expect(await undoEvent(ctx(["admin"]), done.eventId)).toMatchObject({ ok: false });
  });
});

describe("the panel numbers", () => {
  it("counts live demo ads, those on Home, and the last ended batch", async () => {
    await world();
    expect(await demoPanelData()).toMatchObject({ total: 3, active: 2, onHome: 1, ended: null });
    await endDemoAds({ ...admin, confirm: "END 2" });
    const panel = await demoPanelData();
    expect(panel).toMatchObject({ total: 3, active: 0, onHome: 0 });
    expect(panel.ended).toMatchObject({ count: 2, canRestore: true });
  });
});
