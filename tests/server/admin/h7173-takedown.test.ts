import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { getReportDetail, listReports, parseReportQuery } from "@/server/admin/reports";
import { addTakedown } from "@/server/admin/takedown";
import { adKeyOf, DEFAULT_DUE_HOURS } from "@/server/admin/takedown-rules";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, Report } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles: ["admin"], requestId: "r" };
const moderator: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles: ["moderator"], requestId: "r2" };
const oid = () => new mongoose.Types.ObjectId();
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

async function ad(slug = "coffee-in-pune") {
  return Listing.create({ ownerId: oid(), categoryId: oid(), title: "Coffee in Pune", description: "A description that is long enough", slug, status: "active" });
}

function input(extra: Record<string, unknown> = {}) {
  const received = new Date(Date.now() - 2 * HOUR);
  return { ad: "https://www.tharkoo.com/ad/coffee-in-pune/", askedBy: "A. Lawyer for a brand", channel: "email", reason: "Uses a registered logo without permission.", receivedAt: received.toISOString(), dueAt: new Date(received.getTime() + DEFAULT_DUE_HOURS * HOUR).toISOString(), ...extra };
}

describe("H7.173 Add takedown", () => {
  it("reads the ad from a link or an id", () => {
    expect(adKeyOf("https://www.tharkoo.com/ad/coffee-in-pune/?x=1")).toBe("coffee-in-pune");
    expect(adKeyOf("/ad/coffee-in-pune")).toBe("coffee-in-pune");
    expect(adKeyOf("65f0a1b2c3d4e5f607182930")).toBe("65f0a1b2c3d4e5f607182930");
    expect(adKeyOf("   ")).toBe("");
    expect(DEFAULT_DUE_HOURS).toBe(36);
  });

  it("lands in the Legal takedown queue with its due time, who asked and how it arrived, and is audited", async () => {
    const listing = await ad();
    const given = input();
    const done = await addTakedown(admin, given);
    const stored = await Report.findById(done.id).lean();
    expect(stored).toMatchObject({ source: "legal", status: "open", reason: "other", askedBy: "A. Lawyer for a brand", channel: "email" });
    expect(String(stored?.listingId)).toBe(String(listing._id));
    expect(new Date(stored?.slaAckDueAt as Date).toISOString()).toBe(given.dueAt);
    expect(new Date(stored?.createdAt as Date).toISOString()).toBe(given.receivedAt);
    const list = await listReports(["admin"], { ...parseReportQuery({ tab: "legal" }) });
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]).toMatchObject({ dueAt: given.dueAt, reason: "Legal request" });
    expect(list.counts.legal).toBe(1);
    const detail = await getReportDetail(["admin"], "legal", done.id);
    expect(detail.legal).toBe(true);
    expect(detail.reports[0].details).toContain("Asked by A. Lawyer for a brand, by email.");
    expect(detail.reports[0].details).toContain("registered logo");
    expect(await AuditEvent.countDocuments({ action: "report.takedown.add" })).toBe(1);
    const byId = await addTakedown(admin, input({ ad: String(listing._id) }));
    expect(byId.id).not.toBe(done.id);
  });

  it("refuses a missing ad, an unknown how it arrived, a due time before it was received, an empty reason, and a role without the legal permission", async () => {
    await ad();
    await expect(addTakedown(admin, input({ ad: "" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addTakedown(admin, input({ ad: "/ad/no-such-ad/" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(addTakedown(admin, input({ channel: "carrier pigeon" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addTakedown(admin, input({ reason: "  " }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addTakedown(admin, input({ askedBy: "" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(addTakedown(admin, input({ dueAt: new Date(Date.now() - 5 * HOUR).toISOString() }))).rejects.toThrow("after it was received");
    await expect(addTakedown(admin, input({ receivedAt: new Date(Date.now() + 5 * HOUR).toISOString(), dueAt: new Date(Date.now() + 9 * HOUR).toISOString() }))).rejects.toThrow("future");
    await expect(addTakedown(moderator, input())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await Report.countDocuments({})).toBe(0);
  });
});
