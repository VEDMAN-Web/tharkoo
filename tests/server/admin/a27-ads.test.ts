import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { looksLikeJunk } from "@/lib/admin/ads-junk";
import type { AdminCtx } from "@/server/admin/context";
import { BULK_MAX } from "@/lib/admin/ads-bulk-rules";
import { bulkChangeAds, undoAdsBatch } from "@/server/admin/ads-bulk";
import { adsCounts, listAds, parseAdsQuery, type AdsQuery } from "@/server/admin/ads-list";
import { creditWallet, debitWallet } from "@/server/billing/ledger";
import { FEE_REF } from "@/server/billing/posting-fee";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, User } from "@/server/models";
import type { ListingStatus } from "@/server/models/listing";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctx = (roles = ["moderator"]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles, requestId: "r" });
const DAY_MS = 24 * 60 * 60 * 1000;

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

async function ad(title: string, status: ListingStatus, extra: Record<string, unknown> = {}) {
  const row = await Listing.create({ ownerId: owner, status, categoryId: category, title, description: "A well kept thing for sale", ...extra });
  return String(row._id);
}

const query = (changes: Partial<AdsQuery> = {}): AdsQuery => ({ ...parseAdsQuery({}), ...changes });
const titles = async (changes: Partial<AdsQuery> = {}) => (await listAds(["moderator"], query(changes))).rows.map((row) => row.title).sort();

describe("the maybe junk guess", () => {
  it("flags short, vowel-less, repeated and number-only titles and leaves real ones alone", () => {
    for (const title of ["htjkjjhhkh", "ab", "aaaaaa hello", "12345", "  ", "qwrtypsdfghk"]) expect(looksLikeJunk(title), title).toBe(true);
    for (const title of ["2 BHK flat near Adajan", "Honda Activa 2022", "Coffee and a walk", "Study table, teak", "Strengths coaching", "योग कक्षा सुबह"]) expect(looksLikeJunk(title), title).toBe(false);
  });
});

describe("the All ads list", () => {
  it("parses the address and refuses what it does not know", () => {
    expect(parseAdsQuery({ tab: "nope", size: "7", page: "-3", paid: "x", kind: "demo", cat: "zz", junk: "1" })).toMatchObject({ tab: "all", pageSize: 25, page: 1, paid: "all", kind: "demo", category: "", junk: true });
  });

  it("keeps tab counts honest and drafts and deleted ads out of All", async () => {
    await ad("Live one", "active");
    await ad("Waiting one", "pending");
    await ad("Paused one", "paused");
    await ad("Removed one", "removed");
    await ad("Rejected one", "rejected");
    await ad("Expired one", "expired");
    await ad("A draft", "draft");
    await ad("Gone", "deleted");
    expect(await adsCounts()).toMatchObject({ all: 6, live: 1, review: 1, paused: 1, removed: 2, expired: 1, promoted: 0, demo: 0 });
    expect(await titles({ tab: "removed" })).toEqual(["Rejected one", "Removed one"]);
    expect(await titles()).not.toContain("A draft");
  });

  it("pages on the server and reports the total", async () => {
    for (let index = 0; index < 30; index += 1) await ad(`Sofa number ${index}`, "active");
    const first = await listAds(["moderator"], query({ pageSize: 25 }));
    const second = await listAds(["moderator"], query({ pageSize: 25, page: 2 }));
    expect([first.total, first.rows.length, second.rows.length]).toEqual([30, 25, 5]);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(30);
  });

  it("searches by title, ad id and seller name", async () => {
    const id = await ad("Honda Activa 2022", "active");
    await ad("Study table, teak", "active");
    expect(await titles({ q: "activa" })).toEqual(["Honda Activa 2022"]);
    expect(await titles({ q: id })).toEqual(["Honda Activa 2022"]);
    expect(await titles({ q: "Riya" })).toEqual(["Honda Activa 2022", "Study table, teak"]);
    expect(await titles({ q: "nobody-here" })).toEqual([]);
  });

  it("the junk filter in the database matches the guess on the page", async () => {
    const all = ["htjkjjhhkh", "2 BHK flat near Adajan", "ab", "Coffee and a walk", "zzzzzz", "12345", "Honda Activa 2022"];
    for (const title of all) await ad(title, "active");
    const flagged = await titles({ junk: true });
    expect(flagged).toEqual(all.filter(looksLikeJunk).sort());
    const rows = (await listAds(["moderator"], query())).rows;
    expect(rows.filter((row) => row.junk).map((row) => row.title).sort()).toEqual(flagged);
  });

  it("tells paid from free with one wallet aggregate and filters on it", async () => {
    const paid = await ad("Paid sofa", "active");
    await ad("Free sofa", "active");
    await creditWallet({ userId: owner, amount: 100, refType: "seed", refId: "seed-1", requestId: "seed" });
    await debitWallet({ userId: owner, amount: 30, refType: FEE_REF, refId: `${paid}:0`, requestId: "fee", once: true });
    const rows = (await listAds(["moderator"], query())).rows;
    expect(rows.map((row) => [row.title, row.paidCredits]).sort()).toEqual([["Free sofa", 0], ["Paid sofa", 30]]);
    expect(await titles({ paid: "paid" })).toEqual(["Paid sofa"]);
    expect(await titles({ paid: "free" })).toEqual(["Free sofa"]);
  });

  it("shows the Home slot of a chosen live ad and filters on On Home", async () => {
    await ad("Second pick", "active", { homeShow: true, homeOrder: 2 });
    await ad("First pick", "active", { homeShow: true, homeOrder: 1 });
    await ad("Not picked", "active");
    const rows = (await listAds(["moderator"], query({ home: true }))).rows;
    expect(rows.map((row) => [row.title, row.homeSlot]).sort()).toEqual([["First pick", 1], ["Second pick", 2]]);
    expect(await titles({ home: true })).toEqual(["First pick", "Second pick"]);
  });

  it("marks and filters demo ads without touching real ones", async () => {
    const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Demo seller", roles: ["user"], status: "active" });
    await Listing.create({ ownerId: seed._id, status: "active", categoryId: category, title: "Yoga class, mornings", slug: "demo-0001", description: "Demo" });
    await ad("Real sofa", "active");
    expect(await titles({ tab: "demo" })).toEqual(["Yoga class, mornings"]);
    expect(await titles({ kind: "real" })).toEqual(["Real sofa"]);
    expect(await titles({ kind: "demo" })).toEqual(["Yoga class, mornings"]);
    const demoRow = (await listAds(["moderator"], query({ tab: "demo" }))).rows[0];
    expect(demoRow.demo).toBe(true);
    expect((await adsCounts()).demo).toBe(1);
  });

  it("is for staff who may view ads only", async () => {
    await ad("Anything", "active");
    expect((await listAds(["support"], query())).total).toBe(1);
    await expect(listAds(["user"], query())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("bulk pause, resume, extend and remove", () => {
  it("pauses live ads in one batch, skips the rest, and writes one audit row per ad with the same batch id", async () => {
    const live = await ad("Live one", "active");
    const live2 = await ad("Live two", "active");
    const waiting = await ad("Waiting one", "pending");
    const done = await bulkChangeAds(ctx(), { action: "pause", ids: [live, live2, waiting] });
    expect(done.changed).toBe(2);
    expect(done.skipped).toEqual([{ id: waiting, title: "Waiting one", why: "It is pending" }]);
    expect((await Listing.findById(live).lean())?.status).toBe("paused");
    expect((await Listing.findById(waiting).lean())?.status).toBe("pending");
    const rows = await AuditEvent.find({ batchId: done.batchId }).lean();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.action === "listing.pause" && row.undo?.kind === "listing.decision")).toBe(true);
    expect(done.eventIds.sort()).toEqual(rows.map((row) => String(row._id)).sort());
  });

  it("resumes paused ads and extends the end date by 30 days from the later of the old end and now", async () => {
    const soon = new Date(Date.now() + 5 * DAY_MS);
    const old = new Date(Date.now() - 5 * DAY_MS);
    const a = await ad("Ends soon", "active", { expiresAt: soon });
    const b = await ad("Ended a while ago", "paused", { expiresAt: old });
    const c = await ad("No end date", "active");
    await bulkChangeAds(ctx(), { action: "extend", ids: [a, b, c] });
    const [after, afterPaused, afterNone] = await Promise.all([a, b, c].map((id) => Listing.findById(id).lean()));
    expect(Math.round(((after?.expiresAt?.getTime() ?? 0) - soon.getTime()) / DAY_MS)).toBe(30);
    expect(Math.abs((afterPaused?.expiresAt?.getTime() ?? 0) - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000);
    expect(Math.abs((afterNone?.expiresAt?.getTime() ?? 0) - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000);
    expect(afterPaused?.status).toBe("paused");
    const resumed = await bulkChangeAds(ctx(), { action: "resume", ids: [b, a] });
    expect(resumed.changed).toBe(1);
    expect((await Listing.findById(b).lean())?.status).toBe("active");
  });

  it("removes with a required reason, never gives credits back, and asks to type the number from 50 ads", async () => {
    const one = await ad("Spam ad", "active");
    await expect(bulkChangeAds(ctx(), { action: "remove", ids: [one], reason: "  " })).rejects.toBeInstanceOf(ValidationError);
    const done = await bulkChangeAds(ctx(), { action: "remove", ids: [one], reason: "Spam" });
    expect(done.changed).toBe(1);
    expect((await Listing.findById(one).lean())?.status).toBe("removed");
    expect(await AuditEvent.findOne({ batchId: done.batchId }).lean()).toMatchObject({ action: "listing.remove", reason: "Spam" });
    const many: string[] = [];
    for (let index = 0; index < 50; index += 1) many.push(await ad(`Bulk ad ${index}`, "active"));
    await expect(bulkChangeAds(ctx(), { action: "remove", ids: many, reason: "Spam" })).rejects.toBeInstanceOf(ValidationError);
    await expect(bulkChangeAds(ctx(), { action: "remove", ids: many, reason: "Spam", confirm: "49" })).rejects.toBeInstanceOf(ValidationError);
    expect((await bulkChangeAds(ctx(), { action: "remove", ids: many, reason: "Spam", confirm: "50" })).changed).toBe(50);
  });

  it("refuses roles without the right, bad ids, an empty list and more than the limit", async () => {
    const id = await ad("Live one", "active");
    await expect(bulkChangeAds(ctx(["support"]), { action: "pause", ids: [id] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(bulkChangeAds(ctx(["trust_safety"]), { action: "pause", ids: [id] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(bulkChangeAds(ctx(["trust_safety"]), { action: "remove", ids: [id], reason: "Spam" })).resolves.toMatchObject({ changed: 1 });
    await expect(bulkChangeAds(ctx(), { action: "pause", ids: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(bulkChangeAds(ctx(), { action: "pause", ids: ["nope"] })).rejects.toBeInstanceOf(ValidationError);
    const tooMany = Array.from({ length: BULK_MAX + 1 }, () => String(new mongoose.Types.ObjectId()));
    await expect(bulkChangeAds(ctx(), { action: "pause", ids: tooMany })).rejects.toBeInstanceOf(ValidationError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBeGreaterThan(0);
  });

  it("one undo brings every row of the batch back, status and end date, and refuses events of another batch", async () => {
    const soon = new Date(Date.now() + 5 * DAY_MS);
    const a = await ad("Live one", "active", { expiresAt: soon });
    const b = await ad("Live two", "active");
    const paused = await bulkChangeAds(ctx(), { action: "pause", ids: [a, b] });
    const undone = await undoAdsBatch(ctx(), { batchId: paused.batchId, eventIds: paused.eventIds });
    expect(undone).toEqual({ restored: 2, failed: [] });
    expect((await Listing.find({ _id: { $in: [a, b] } }).lean()).map((row) => row.status)).toEqual(["active", "active"]);
    const extended = await bulkChangeAds(ctx(), { action: "extend", ids: [a, b] });
    expect((await Listing.findById(a).lean())?.expiresAt?.getTime()).not.toBe(soon.getTime());
    await undoAdsBatch(ctx(), { batchId: extended.batchId, eventIds: extended.eventIds });
    expect((await Listing.findById(a).lean())?.expiresAt?.getTime()).toBe(soon.getTime());
    expect((await Listing.findById(b).lean())?.expiresAt).toBeUndefined();
    await expect(undoAdsBatch(ctx(), { batchId: "another-batch", eventIds: extended.eventIds })).rejects.toBeInstanceOf(ValidationError);
    const twice = await undoAdsBatch(ctx(), { batchId: extended.batchId, eventIds: extended.eventIds });
    expect(twice.restored).toBe(0);
    expect(twice.failed).toHaveLength(2);
  });

  it("an undo that finds the ad changed since reports it instead of overwriting", async () => {
    const id = await ad("Live one", "active");
    const done = await bulkChangeAds(ctx(), { action: "pause", ids: [id] });
    await Listing.updateOne({ _id: id }, { $set: { status: "removed" } });
    const undone = await undoAdsBatch(ctx(), { batchId: done.batchId, eventIds: done.eventIds });
    expect(undone.restored).toBe(0);
    expect(undone.failed).toHaveLength(1);
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
  });
});
