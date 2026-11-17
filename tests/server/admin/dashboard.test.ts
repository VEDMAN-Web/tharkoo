import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDashboardData, recentChanges } from "@/server/admin/dashboard";
import { AuditEvent, Listing, Payment, User, type ListingStatus } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 15:30 on 15 June in India. */
const NOW = new Date("2026-06-15T10:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const oid = () => new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

async function person(email: string, createdAt: Date, name = "Test") {
  return User.create({ email, passwordHash: "hash", displayName: name, dateOfBirth: new Date("1995-04-02"), attestedAdultAt: createdAt, createdAt });
}

function ad(ownerId: mongoose.Types.ObjectId, status: ListingStatus, createdAt: Date, slug?: string) {
  return { ownerId, status, categoryId: oid(), title: "Ad", description: "A plain description", createdAt, ...(slug ? { slug } : {}) };
}

describe("getDashboardData (A10)", () => {
  it("counts real ads only: demo ads, drafts and deleted ads are left out, and the day is Indian time", async () => {
    const seed = await person(SEED_USER_EMAIL, ago(40 * DAY), "Seed");
    const owner = await person("owner@example.test", ago(40 * DAY));
    await Listing.create([
      ad(owner._id, "active", ago(HOUR)),
      ad(owner._id, "active", ago(2 * HOUR)),
      ad(owner._id, "pending", ago(HOUR)),
      ad(owner._id, "draft", ago(HOUR)),
      ad(owner._id, "deleted", ago(HOUR)),
      ad(owner._id, "active", ago(3 * DAY)),
      ad(seed._id, "active", ago(HOUR), "demo-0001"),
      ad(seed._id, "active", ago(2 * HOUR), "demo-0002"),
    ]);
    await Listing.create({ ...ad(owner._id, "active", new Date("2026-06-14T19:00:00.000Z")) });
    const data = await getDashboardData(NOW);
    expect(data.liveAds).toBe(4);
    expect(data.newAdsToday).toBe(4);
    expect(data.newAdsPerDay).toHaveLength(30);
    expect(data.newAdsPerDay.find((day) => day.date === "2026-06-12")?.count).toBe(1);
    expect(data.newAdsPerDay.reduce((total, day) => total + day.count, 0)).toBe(5);
    expect(data.demoActive).toBe(2);
  });

  it("counts new users since the start of the Indian day", async () => {
    await person("a@example.test", ago(HOUR));
    await person("b@example.test", ago(3 * HOUR));
    await person("c@example.test", ago(2 * DAY));
    expect((await getDashboardData(NOW)).newUsersToday).toBe(2);
  });

  it("leaves test payments out of today's sales and counts them apart", async () => {
    const owner = await person("buyer@example.test", ago(DAY));
    const base = { userId: owner._id, orderId: oid(), currency: "INR", status: "paid" as const, updatedAt: ago(HOUR) };
    await Payment.collection.insertMany([
      { ...base, idempotencyKey: "r1", provider: "razorpay", amount: 1000, credits: 100 },
      { ...base, idempotencyKey: "r2", provider: "razorpay", amount: 500, credits: 50 },
      { ...base, idempotencyKey: "m1", provider: "mock", amount: 9999, credits: 999 },
      { ...base, idempotencyKey: "r3", provider: "razorpay", amount: 700, credits: 70, status: "pending" },
      { ...base, idempotencyKey: "r4", provider: "razorpay", amount: 800, credits: 80, updatedAt: ago(2 * DAY) },
    ]);
    const { sales } = await getDashboardData(NOW);
    expect(sales).toEqual({ rupees: 1500, credits: 150, orders: 2, testOrders: 1 });
  });

  it("shows zero and an empty list instead of invented numbers when the database is empty", async () => {
    const data = await getDashboardData(NOW);
    expect(data.liveAds).toBe(0);
    expect(data.newUsersToday).toBe(0);
    expect(data.sales).toEqual({ rupees: 0, credits: 0, orders: 0, testOrders: 0 });
    expect(data.recent).toEqual([]);
    expect(data.demoActive).toBe(0);
    expect(data.newAdsPerDay.every((day) => day.count === 0)).toBe(true);
  });
});

describe("recentChanges (A10)", () => {
  it("lists the last five staff changes newest first, with Undo only while allowed", async () => {
    const staff = await person("staff@example.test", ago(DAY), "Ayesha");
    const row = (summary: string, createdAt: Date, extra: Record<string, unknown> = {}) => ({
      actorType: "admin" as const,
      actorId: staff._id,
      action: "listing.reject",
      targetType: "listing",
      targetId: "t1",
      targetLabel: "Coffee and a walk",
      requestId: "r",
      summary,
      createdAt,
      ...extra,
    });
    const open = await AuditEvent.create(row("Removed an ad", ago(2 * HOUR), { undo: { kind: "listing.decision", until: new Date(NOW.getTime() + DAY) } }));
    await AuditEvent.create(row("Ticked something", ago(3 * HOUR)));
    await AuditEvent.create(row("Sent a refund", ago(4 * HOUR), { lock: "money_sent", undo: { kind: "wallet.adjust", until: new Date(NOW.getTime() + DAY) } }));
    await AuditEvent.create(row("Edited an old ad", ago(5 * HOUR), { undo: { kind: "listing.edit", until: ago(HOUR) } }));
    const undone = await AuditEvent.create(row("Banned a user", ago(7 * HOUR), { undo: { kind: "user.ban", until: new Date(NOW.getTime() + DAY) } }));
    await AuditEvent.create(row("Un-banned a user", ago(6 * HOUR), { undoOf: undone._id }));
    await AuditEvent.create({ actorType: "user", action: "listing.contact_reveal", targetType: "listing", targetId: "t", requestId: "r", createdAt: ago(10 * 60 * 1000) });
    await AuditEvent.create({ ...row("Tried and was refused", ago(HOUR)), action: "admin.write.denied" });
    const rows = await recentChanges(NOW);
    expect(rows.map((item) => item.summary)).toEqual(["Removed an ad", "Ticked something", "Sent a refund", "Edited an old ad", "Un-banned a user"]);
    expect(rows[0]).toMatchObject({ id: String(open._id), who: "Ayesha", label: "Coffee and a walk", undoable: true });
    expect(rows[1].undoable).toBe(false);
    expect(rows[2]).toMatchObject({ undoable: false, lock: "money_sent" });
    expect(rows[3].undoable).toBe(false);
    expect(rows[4].undoable).toBe(false);
    expect((await recentChanges(NOW, 7)).find((item) => item.summary === "Banned a user")?.undoable).toBe(false);
  });
});
