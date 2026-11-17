import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { actOnReports, getReportDetail, listReports, reportCounts, type ReportTab } from "@/server/admin/reports";
import { undoEvent } from "@/server/admin/undo/core";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { FEE_REF } from "@/server/billing/posting-fee";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, Report, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();
const ctx = (roles: string[]): AdminCtx => ({ actorId: String(oid()), email: "staff@example.test", roles, requestId: "r" });
const admin = ctx(["admin"]);
const moderator = ctx(["moderator"]);
const FEE = 30;

let owner = "";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  const user = await User.create({ email: "seller@example.test", displayName: "Riya", roles: ["user"], status: "active" });
  owner = String(user._id);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function ad(paid = false, title = "Coffee and a walk") {
  const row = await Listing.create({ ownerId: owner, status: "active", categoryId: oid(), title, description: "A description that is long enough", publishedAt: new Date() });
  const id = String(row._id);
  if (paid) {
    await creditWallet({ userId: owner, amount: 100, refType: "seed", refId: `seed-${id}`, requestId: "s" });
    await debitWallet({ userId: owner, amount: FEE, refType: FEE_REF, refId: `${id}:0`, requestId: "f", once: true });
  }
  return id;
}

async function report(listingId: string, extra: Record<string, unknown> = {}) {
  const row = await Report.create({ listingId, reason: "fake", severity: "S3", status: "open", details: "Photos are from a social profile", ...extra });
  return String(row._id);
}

const act = (roles: AdminCtx, tab: ReportTab, id: string, action: Parameters<typeof actOnReports>[1]["action"], extra: { note?: string; refund?: boolean } = {}) =>
  actOnReports(roles, { tab, id, action, note: extra.note ?? "", refund: extra.refund === true });

describe("lists", () => {
  it("groups open reports by ad, urgent first, and keeps legal requests and closed reports on their own tabs", async () => {
    const a = await ad(false, "Fake photos");
    const b = await ad(false, "Wrong price");
    await report(a);
    await report(a, { reason: "prohibited_content", severity: "S1" });
    await report(b);
    const legalAd = await ad(false, "Photo used without consent");
    await report(legalAd, { source: "legal", reason: "other", severity: "S2", slaAckDueAt: new Date(Date.now() + 3 * 3_600_000) });
    const closedAd = await ad(false, "Old one");
    await report(closedAd, { status: "dismissed", resolvedAt: new Date() });
    const open = await listReports(["moderator"], { tab: "open", q: "", page: 1, pageSize: 25 });
    expect(open.rows.map((row) => [row.title, row.count, row.urgent])).toEqual([["Fake photos", 2, true], ["Wrong price", 1, false]]);
    expect(open.counts).toEqual({ open: 2, legal: 1, closed: 1 });
    expect(await reportCounts()).toEqual({ open: 2, legal: 1, closed: 1 });
    const legal = await listReports(["trust_safety"], { tab: "legal", q: "", page: 1, pageSize: 25 });
    expect(legal.rows[0]).toMatchObject({ title: "Photo used without consent", reason: "Legal request" });
    expect(legal.rows[0].dueAt).toBeTruthy();
    const closed = await listReports(["moderator"], { tab: "closed", q: "", page: 1, pageSize: 25 });
    expect(closed.rows.map((row) => row.title)).toEqual(["Old one"]);
    await expect(listReports(["moderator"], { tab: "legal", q: "", page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listReports(["support"], { tab: "open", q: "", page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ForbiddenError);
    const detail = await getReportDetail(["moderator"], "open", a);
    expect(detail).toMatchObject({ title: "Fake photos", seller: "Riya", legal: false });
    expect(detail.reports).toHaveLength(2);
  });
});

describe("decisions and undo", () => {
  it("dismisses the reports of an ad, audits it, and Undo opens them again once", async () => {
    const id = await ad();
    const first = await report(id);
    await report(id);
    const done = await act(moderator, "open", id, "dismiss", { note: "Photos are the seller's own" });
    expect(await Report.countDocuments({ status: "dismissed" })).toBe(2);
    expect((await Report.findById(first).lean())?.note).toBe("Photos are the seller's own");
    expect(await AuditEvent.countDocuments({ action: "report.dismiss", targetId: id })).toBe(1);
    expect((await undoEvent(moderator, done.eventIds[0])).ok).toBe(true);
    expect(await Report.countDocuments({ status: "open" })).toBe(2);
    expect((await Report.findById(first).lean())?.resolvedAt).toBeUndefined();
    expect(await undoEvent(moderator, done.eventIds[0])).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("pauses the ad and closes the reports, and Undo puts the ad live and the reports open", async () => {
    const id = await ad();
    await report(id);
    const done = await act(moderator, "open", id, "pause");
    expect((await Listing.findById(id).lean())?.status).toBe("paused");
    expect(await Report.countDocuments({ status: "actioned" })).toBe(1);
    expect((await undoEvent(moderator, done.eventIds[0])).ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    expect(await Report.countDocuments({ status: "open" })).toBe(1);
  });

  it("removes a paid ad with the credits given back only when asked, and undoing every step brings it all back", async () => {
    const id = await ad(true);
    await report(id);
    expect(await walletBalance(owner)).toBe(70);
    const done = await act(moderator, "open", id, "remove", { refund: true });
    expect(done.eventIds).toHaveLength(2);
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
    expect(await walletBalance(owner)).toBe(100);
    expect(await Report.countDocuments({ status: "actioned" })).toBe(1);
    for (const eventId of [...done.eventIds].reverse()) expect((await undoEvent(moderator, eventId)).ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    expect(await Report.countDocuments({ status: "open" })).toBe(1);
    expect(await walletBalance(owner)).toBe(70);
    const again = await act(moderator, "open", id, "remove");
    expect(await walletBalance(owner)).toBe(70);
    expect(again.eventIds).toHaveLength(2);
  });

  it("removes the ad and bans the seller, and Undo reverses the ban, the reports and the ad", async () => {
    const id = await ad();
    await report(id);
    const done = await act(admin, "open", id, "removeBan");
    expect(done.eventIds).toHaveLength(3);
    expect((await User.findById(owner).lean())?.status).toBe("suspended");
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
    for (const eventId of [...done.eventIds].reverse()) expect((await undoEvent(admin, eventId)).ok).toBe(true);
    expect((await User.findById(owner).lean())?.status).toBe("active");
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    expect(await Report.countDocuments({ status: "open" })).toBe(1);
  });

  it("refuses a ban from a moderator, a role that cannot handle reports, an ad that is not live, and an unknown action", async () => {
    const id = await ad();
    await report(id);
    await expect(act(moderator, "open", id, "removeBan")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(act(ctx(["support"]), "open", id, "dismiss")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    await Listing.updateOne({ _id: id }, { $set: { status: "paused" } });
    await expect(act(moderator, "open", id, "pause")).rejects.toBeInstanceOf(ConflictError);
    await expect(act(moderator, "open", id, "delete" as never)).rejects.toBeInstanceOf(ValidationError);
    expect(await Report.countDocuments({})).toBe(1);
  });

  it("returns a conflict on Undo when a report changed after the decision", async () => {
    const id = await ad();
    const reportId = await report(id);
    const done = await act(moderator, "open", id, "dismiss");
    await Report.updateOne({ _id: reportId }, { $set: { status: "actioned" } });
    expect(await undoEvent(moderator, done.eventIds[0])).toMatchObject({ ok: false, reason: "conflict" });
  });
});

describe("legal takedown requests", () => {
  it("can be acknowledged, closed and reopened by trust and safety, never deleted, and a moderator cannot touch them", async () => {
    const id = await ad();
    const legalId = await report(id, { source: "legal", reason: "other", severity: "S2", slaAckDueAt: new Date(Date.now() + 3_600_000) });
    const trust = ctx(["trust_safety"]);
    await expect(act(moderator, "legal", legalId, "ack")).rejects.toBeInstanceOf(ForbiddenError);
    await act(trust, "legal", legalId, "ack");
    const acked = await Report.findById(legalId).lean();
    expect(acked?.status).toBe("ack");
    expect(acked?.ackAt).toBeTruthy();
    const closed = await act(trust, "legal", legalId, "close", { note: "Not upheld" });
    expect((await Report.findById(legalId).lean())?.status).toBe("dismissed");
    const reopened = await act(trust, "closed", legalId, "reopen");
    const back = await Report.findById(legalId).lean();
    expect(back?.status).toBe("open");
    expect(back?.resolvedAt).toBeUndefined();
    expect((await undoEvent(trust, reopened.eventIds[0])).ok).toBe(true);
    expect((await Report.findById(legalId).lean())?.status).toBe("dismissed");
    expect((await undoEvent(trust, closed.eventIds[0])).ok).toBe(true);
    expect((await Report.findById(legalId).lean())?.status).toBe("ack");
    await expect(act(trust, "legal", legalId, "delete" as never)).rejects.toBeInstanceOf(ValidationError);
    expect(await Report.countDocuments({ _id: legalId })).toBe(1);
  });

  it("removes the ad for a legal request and the request closes with it", async () => {
    const id = await ad();
    const legalId = await report(id, { source: "legal", reason: "other", severity: "S2" });
    await act(ctx(["trust_safety"]), "legal", legalId, "remove", { note: "Photo used without consent" });
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
    expect((await Report.findById(legalId).lean())?.status).toBe("actioned");
  });
});
