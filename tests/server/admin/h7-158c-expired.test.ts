import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { bulkChangeAds, undoAdsBatch } from "@/server/admin/ads-bulk";
import { AuditEvent, Listing, User, WalletEntry } from "@/server/models";
import type { ListingStatus } from "@/server/models/listing";
import { buildFilter } from "@/server/search/query";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const moderator: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles: ["moderator"], requestId: "r" };
const HOUR = 60 * 60 * 1000;

let owner = "";
let category = new mongoose.Types.ObjectId();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  category = new mongoose.Types.ObjectId();
  owner = String((await User.create({ email: "seller@example.test", displayName: "Riya Thakur", roles: ["user"], status: "active" }))._id);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function ad(title: string, status: ListingStatus, endsInHours: number) {
  const row = await Listing.create({
    ownerId: owner,
    status,
    categoryId: category,
    title,
    description: "A well kept thing for sale",
    slug: `s-${Math.random().toString(36).slice(2, 8)}`,
    publishedAt: new Date(Date.now() - 100 * HOUR),
    expiresAt: new Date(Date.now() + endsInHours * HOUR),
  });
  return String(row._id);
}

const read = async (id: string) => (await Listing.findById(id).lean<{ status: string; expiresAt: Date }>())!;
const visible = async () => Listing.countDocuments((await buildFilter({}))!);
const near = (value: number, expected: number) => Math.abs(value - expected) < 5000;

describe("an ad that ran out of time can be brought back (H7.158c)", () => {
  it("Extend gives it a new end counted from now, makes it live again and visible", async () => {
    const id = await ad("Ran out", "expired", -30);
    expect(await visible()).toBe(0);
    const done = await bulkChangeAds(moderator, { action: "extend", ids: [id], hours: 48 });
    expect(done.changed).toBe(1);
    const row = await read(id);
    expect(row.status).toBe("active");
    expect(near(row.expiresAt.getTime(), Date.now() + 48 * HOUR)).toBe(true);
    expect(await visible()).toBe(1);
  });

  it("Set end and Expire in do the same", async () => {
    const one = await ad("One", "expired", -5);
    const two = await ad("Two", "expired", -5);
    const when = new Date(Date.now() + 30 * HOUR).toISOString();
    await bulkChangeAds(moderator, { action: "setEnd", ids: [one], endsAt: when });
    await bulkChangeAds(moderator, { action: "expireIn", ids: [two], hours: 24 });
    expect((await read(one)).status).toBe("active");
    expect((await read(one)).expiresAt.getTime()).toBe(Date.parse(when));
    expect((await read(two)).status).toBe("active");
    expect(near((await read(two)).expiresAt.getTime(), Date.now() + 24 * HOUR)).toBe(true);
  });

  it("three ads, live, paused and expired, in one batch: only the expired one changes status, and one Undo puts every status and end back", async () => {
    const live = await ad("Live", "active", 5);
    const paused = await ad("Paused", "paused", 6);
    const gone = await ad("Gone", "expired", -7);
    const before = await Promise.all([live, paused, gone].map(read));
    const done = await bulkChangeAds(moderator, { action: "extend", ids: [live, paused, gone], hours: 24 });
    expect(done.changed).toBe(3);
    expect((await read(live)).status).toBe("active");
    expect((await read(paused)).status).toBe("paused");
    expect((await read(gone)).status).toBe("active");
    expect(await AuditEvent.countDocuments({ batchId: done.batchId, action: "listing.extend" })).toBe(3);
    const undone = await undoAdsBatch(moderator, { batchId: done.batchId, eventIds: done.eventIds });
    expect(undone).toEqual({ restored: 3, failed: [] });
    const after = await Promise.all([live, paused, gone].map(read));
    expect(after.map((row) => row.status)).toEqual(before.map((row) => row.status));
    expect(after.map((row) => row.expiresAt.getTime())).toEqual(before.map((row) => row.expiresAt.getTime()));
    expect(await visible()).toBe(1);
  });

  it("a removed, rejected or archived ad stays out, and End now does not take an ad that already ended", async () => {
    const removed = await ad("Removed", "removed", -5);
    const rejected = await ad("Rejected", "rejected", -5);
    const archived = await ad("Archived", "archived", -5);
    const expired = await ad("Expired", "expired", -5);
    for (const action of ["extend", "setEnd", "expireIn"] as const) {
      const done = await bulkChangeAds(moderator, { action, ids: [removed, rejected, archived], hours: 24, endsAt: new Date(Date.now() + 5 * HOUR).toISOString() });
      expect(done.changed).toBe(0);
      expect(done.skipped).toHaveLength(3);
    }
    expect((await bulkChangeAds(moderator, { action: "endNow", ids: [expired], reason: "x" })).changed).toBe(0);
    for (const id of [removed, rejected, archived]) expect((await read(id)).status).not.toBe("active");
  });

  it("moves no credits", async () => {
    const id = await ad("Money", "expired", -5);
    await bulkChangeAds(moderator, { action: "extend", ids: [id], hours: 24 });
    expect(await WalletEntry.countDocuments({})).toBe(0);
  });
});
