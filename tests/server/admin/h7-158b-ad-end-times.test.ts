import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { endsIn, istDateTime, istInputToIso, istInputValue } from "@/lib/admin/ad-ends";
import { EXTEND_CHOICES } from "@/lib/admin/ads-bulk-rules";
import type { AdminCtx } from "@/server/admin/context";
import { bulkChangeAds, undoAdsBatch } from "@/server/admin/ads-bulk";
import { listAds, parseAdsQuery, type AdsQuery } from "@/server/admin/ads-list";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, User, WalletEntry } from "@/server/models";
import type { ListingStatus } from "@/server/models/listing";
import { buildFilter } from "@/server/search/query";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const moderator: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles: ["moderator"], requestId: "r" };
const support: AdminCtx = { ...moderator, roles: ["support"] };
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

async function ad(title: string, status: ListingStatus, endsInHours: number | null) {
  const row = await Listing.create({
    ownerId: owner,
    status,
    categoryId: category,
    title,
    description: "A well kept thing for sale",
    slug: `s-${Math.random().toString(36).slice(2, 8)}`,
    publishedAt: new Date(Date.now() - HOUR),
    ...(endsInHours === null ? {} : { expiresAt: new Date(Date.now() + endsInHours * HOUR) }),
  });
  return String(row._id);
}

const endOf = async (id: string) => (await Listing.findById(id).lean<{ expiresAt?: Date }>())?.expiresAt?.getTime() ?? 0;
const near = (value: number, expected: number, ms = 5000) => Math.abs(value - expected) < ms;

describe("the Extend choices (H7.158)", () => {
  it("offers 24 hours, 48 hours, 7 days and 30 days", () => {
    expect(EXTEND_CHOICES.map((choice) => [choice.hours, choice.label])).toEqual([
      [24, "+24 hours"],
      [48, "+48 hours"],
      [168, "+7 days"],
      [720, "+30 days"],
    ]);
  });

  it("adds each length to the current end, and to now for an ad whose end has passed", async () => {
    const soon = await ad("Soon", "active", 5);
    const late = await ad("Late", "active", -10);
    const was = await endOf(soon);
    for (const choice of EXTEND_CHOICES) {
      await bulkChangeAds(moderator, { action: "extend", ids: [soon], hours: choice.hours });
    }
    expect(near(await endOf(soon), was + (24 + 48 + 168 + 720) * HOUR)).toBe(true);
    await bulkChangeAds(moderator, { action: "extend", ids: [late], hours: 48 });
    expect(near(await endOf(late), Date.now() + 48 * HOUR)).toBe(true);
  });

  it("keeps the old 30 days when no length is given, and refuses a length that is not in the list", async () => {
    const id = await ad("Plain", "active", 2);
    const was = await endOf(id);
    await bulkChangeAds(moderator, { action: "extend", ids: [id] });
    expect(near(await endOf(id), was + 720 * HOUR)).toBe(true);
    await expect(bulkChangeAds(moderator, { action: "extend", ids: [id], hours: 5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("a paused ad stays paused, and an ad that is not live or paused is skipped", async () => {
    const paused = await ad("Paused", "paused", 3);
    const gone = await ad("Gone", "removed", 3);
    const done = await bulkChangeAds(moderator, { action: "extend", ids: [paused, gone], hours: 24 });
    expect(done.changed).toBe(1);
    expect(done.skipped.map((row) => row.id)).toEqual([gone]);
    expect((await Listing.findById(paused))?.status).toBe("paused");
  });

  it("three ads in one batch, one Undo puts every old end back", async () => {
    const ids = [await ad("One", "active", 10), await ad("Two", "active", 20), await ad("Three", "paused", 30)];
    const before = await Promise.all(ids.map(endOf));
    const done = await bulkChangeAds(moderator, { action: "extend", ids, hours: 168 });
    expect(done.changed).toBe(3);
    expect(await AuditEvent.countDocuments({ batchId: done.batchId, action: "listing.extend" })).toBe(3);
    for (const [index, id] of ids.entries()) expect(near(await endOf(id), before[index] + 168 * HOUR)).toBe(true);
    const undone = await undoAdsBatch(moderator, { batchId: done.batchId, eventIds: done.eventIds });
    expect(undone).toEqual({ restored: 3, failed: [] });
    for (const [index, id] of ids.entries()) expect(await endOf(id)).toBe(before[index]);
  });

  it("writes the new end in a plain Indian-time date in the History sentence, not as a raw ISO date", async () => {
    const id = await ad("Plain end", "active", 5);
    const done = await bulkChangeAds(moderator, { action: "extend", ids: [id], hours: 24 });
    const row = await AuditEvent.findOne({ batchId: done.batchId, action: "listing.extend" }).lean();
    expect(row?.summary).toMatch(/^Extended, ends [0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?, [0-9]{1,2}:[0-9]{2} (am|pm): Plain end$/);
    expect(row?.summary).not.toMatch(/[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });

  it("is for staff who may edit ads, and moves no credits", async () => {
    const id = await ad("Money", "active", 5);
    await expect(bulkChangeAds(support, { action: "extend", ids: [id], hours: 24 })).rejects.toBeInstanceOf(ForbiddenError);
    await bulkChangeAds(moderator, { action: "extend", ids: [id], hours: 24 });
    expect(await WalletEntry.countDocuments({})).toBe(0);
  });
});

describe("Set end and Expire in (H7.158)", () => {
  it("sets the end of each selected ad to a time in the future, with one Undo", async () => {
    const ids = [await ad("A", "active", 100), await ad("B", "active", 2)];
    const before = await Promise.all(ids.map(endOf));
    const when = new Date(Date.now() + 30 * HOUR).toISOString();
    const done = await bulkChangeAds(moderator, { action: "setEnd", ids, endsAt: when });
    for (const id of ids) expect(await endOf(id)).toBe(Date.parse(when));
    expect(await AuditEvent.countDocuments({ batchId: done.batchId, action: "listing.set_end" })).toBe(2);
    await undoAdsBatch(moderator, { batchId: done.batchId, eventIds: done.eventIds });
    expect(await Promise.all(ids.map(endOf))).toEqual(before);
  });

  it("refuses a time in the past, a word, nothing, and a time more than a year ahead", async () => {
    const id = await ad("A", "active", 5);
    for (const endsAt of [new Date(Date.now() - HOUR).toISOString(), "soon", "", new Date(Date.now() + 400 * 24 * HOUR).toISOString()]) {
      await expect(bulkChangeAds(moderator, { action: "setEnd", ids: [id], endsAt })).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("Expire in 24 h ends the ad 24 hours from now, even if it would have run longer", async () => {
    const id = await ad("Long", "active", 90);
    await bulkChangeAds(moderator, { action: "expireIn", ids: [id], hours: 24 });
    expect(near(await endOf(id), Date.now() + 24 * HOUR)).toBe(true);
    await expect(bulkChangeAds(moderator, { action: "expireIn", ids: [id], hours: 7 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("End now (H7.158)", () => {
  it("needs a reason, expires the ad at once, takes it out of the public query, and Undo brings it back", async () => {
    const id = await ad("Bicycle", "active", 20);
    const was = await endOf(id);
    await expect(bulkChangeAds(moderator, { action: "endNow", ids: [id] })).rejects.toBeInstanceOf(ValidationError);
    const filter = (await buildFilter({}))!;
    expect(await Listing.countDocuments(filter)).toBe(1);
    const done = await bulkChangeAds(moderator, { action: "endNow", ids: [id], reason: "The seller sold it" });
    const row = await Listing.findById(id).lean<{ status: string; expiresAt: Date }>();
    expect(row?.status).toBe("expired");
    expect(near(row!.expiresAt.getTime(), Date.now())).toBe(true);
    expect(await Listing.countDocuments((await buildFilter({}))!)).toBe(0);
    const event = await AuditEvent.findOne({ action: "listing.end_now" }).lean<{ reason?: string }>();
    expect(event?.reason).toBe("The seller sold it");
    const undone = await undoEvent(moderator, done.eventIds[0]);
    expect(undone.ok).toBe(true);
    expect((await Listing.findById(id))?.status).toBe("active");
    expect(await endOf(id)).toBe(was);
    expect(await Listing.countDocuments((await buildFilter({}))!)).toBe(1);
  });

  it("an ad that already ended is skipped", async () => {
    const id = await ad("Old", "expired", -5);
    const done = await bulkChangeAds(moderator, { action: "endNow", ids: [id], reason: "x" });
    expect(done.changed).toBe(0);
    expect(done.skipped).toHaveLength(1);
  });
});

describe("the All ads list: Ends, sort and the 24 hour filter (H7.158)", () => {
  const query = (changes: Partial<AdsQuery> = {}): AdsQuery => ({ ...parseAdsQuery({}), ...changes });

  it("reads the sort and the filter from the address", () => {
    expect(parseAdsQuery({})).toMatchObject({ sort: "new", endsSoon: false });
    expect(parseAdsQuery({ sort: "ends", ends: "24" })).toMatchObject({ sort: "ends", endsSoon: true });
    expect(parseAdsQuery({ sort: "ends_last" })).toMatchObject({ sort: "ends_last" });
    expect(parseAdsQuery({ sort: "nope", ends: "5" })).toMatchObject({ sort: "new", endsSoon: false });
  });

  it("sorts by the end time both ways and gives each row its end", async () => {
    await ad("Later", "active", 40);
    await ad("Sooner", "active", 3);
    await ad("Middle", "paused", 10);
    const soonest = (await listAds(["moderator"], query({ sort: "ends" }))).rows;
    expect(soonest.map((row) => row.title)).toEqual(["Sooner", "Middle", "Later"]);
    expect(soonest[0].expiresAt).toBeTruthy();
    expect((await listAds(["moderator"], query({ sort: "ends_last" }))).rows.map((row) => row.title)).toEqual(["Later", "Middle", "Sooner"]);
  });

  it("Ends within 24 h lists only live or paused ads that end in the next 24 hours", async () => {
    await ad("In 3 h", "active", 3);
    await ad("In 23 h", "paused", 23);
    await ad("In 30 h", "active", 30);
    await ad("Already ended", "active", -1);
    await ad("Removed soon", "removed", 3);
    const found = (await listAds(["moderator"], query({ endsSoon: true }))).rows.map((row) => row.title).sort();
    expect(found).toEqual(["In 23 h", "In 3 h"]);
  });
});

describe("how an end time is shown (H7.158)", () => {
  it("says in minutes, hours or days, and ended", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(endsIn(new Date(now - 1000).toISOString(), now)).toBe("ended");
    expect(endsIn(new Date(now + 12 * 60_000).toISOString(), now)).toBe("in 12 min");
    expect(endsIn(new Date(now + 5 * HOUR).toISOString(), now)).toBe("in 5 h");
    expect(endsIn(new Date(now + 47 * HOUR).toISOString(), now)).toBe("in 47 h");
    expect(endsIn(new Date(now + 72 * HOUR).toISOString(), now)).toBe("in 3 days");
  });

  it("shows India time and reads a date and time input as India time", () => {
    expect(istDateTime("2026-11-14T12:30:00Z")).toMatch(/^14 Nov, 06:00 pm$/i);
    expect(istInputValue("2026-11-14T12:30:00Z")).toBe("2026-11-14T18:00");
    expect(istInputToIso("2026-11-14T18:00")).toBe("2026-11-14T12:30:00.000Z");
    expect(istInputToIso("")).toBeNull();
    expect(istInputToIso("tomorrow")).toBeNull();
  });
});
