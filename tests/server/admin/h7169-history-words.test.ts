import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { actionWords, dateWords, fieldLabel, plainSentence, plainValue, targetWords } from "@/lib/admin/history-words";
import type { AdminCtx } from "@/server/admin/context";
import { historyCsv, historyDetail, listHistory, parseHistoryQuery } from "@/server/admin/history";
import { updatePlan } from "@/server/billing/plans-admin";
import { AuditEvent, PromotionProduct } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles: ["admin"], requestId: "req" };

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

describe("History & undo in plain words (H7.169)", () => {
  it("names a field in words, never as code", () => {
    expect(fieldLabel("durationHours")).toBe("Lasts (hours)");
    expect(fieldLabel("homeOrder")).toBe("Place on the Home page");
    expect(fieldLabel("photo.alt")).toBe("Photo: picture description");
    expect(fieldLabel("someBrandNewKey")).toBe("Some brand new key");
    expect(fieldLabel("restore_version")).toBe("Restore version");
  });

  it("writes a value the way a person says it", () => {
    expect(plainValue("true")).toBe("Yes");
    expect(plainValue("false")).toBe("No");
    expect(plainValue("null")).toBe("");
    expect(plainValue("2026-06-15T10:00:00.000Z")).toBe("15 Jun, 3:30 pm");
    expect(plainValue('["admin","support"]')).toBe("admin, support");
    expect(plainValue("507f1f77bcf86cd799439011")).toBe("a record");
    expect(plainValue("Hello there")).toBe("Hello there");
  });

  it("writes a date and time in Indian time as a person says it, and a raw date inside a sentence the same way", () => {
    const now = new Date("2026-11-18T05:00:00.000Z");
    expect(dateWords("2026-11-19T06:22:12.469Z", now)).toBe("19 Nov, 11:52 am");
    expect(dateWords("2026-06-15T18:35:00.000Z", now)).toBe("16 Jun, 12:05 am");
    expect(dateWords("2027-01-02T06:30:00.000Z", now)).toBe("2 Jan 2027, 12:00 pm");
    expect(plainSentence("Extended, ends 2026-11-19T06:22:12.469Z: Honda", now)).toBe("Extended, ends 19 Nov, 11:52 am: Honda");
    expect(plainSentence("No date here", now)).toBe("No date here");
  });

  it("an old audit row that still carries a raw date reads plainly in the list and the CSV", async () => {
    const row = await AuditEvent.create({ actorType: "admin", actorId: admin.actorId, action: "listing.extend", summary: "Extended, ends 2026-11-19T06:22:12.469Z: Honda", targetType: "listing", targetId: "a1", targetLabel: "Honda", requestId: "r9" });
    const list = await listHistory(admin, parseHistoryQuery({ tab: "audit", days: "0" }));
    expect(list.rows[0].title).toMatch(/^Extended, ends 19 Nov( 2026)?, 11:52 am: Honda$/);
    expect(list.rows[0].title).not.toContain("T06:22");
    const csv = await historyCsv(admin, parseHistoryQuery({ tab: "audit", days: "0" }));
    expect(csv).not.toContain("2026-11-19T06:22");
    expect(String(row._id)).toBeTruthy();
  });

  it("says an audit action as a sentence: known ones by name, others as their words", () => {
    expect(actionWords("listing.contact_reveal")).toBe("A visitor showed a phone number");
    expect(actionWords("some.new_thing.happened")).toBe("Some new thing happened");
    expect(actionWords("admin.bootstrap")).toBe("The first admin account was set up");
    expect(actionWords("settings.id_check.default")).toBe("ID check before posting set to its default");
    expect(targetWords("support_ticket")).toBe("A support ticket");
    expect(targetWords("odd_record")).toBe("Odd record");
  });

  it("a full audit log row with no sentence shows the plain action and the kind of record, not codes; the CSV does too", async () => {
    await AuditEvent.create({ actorType: "user", action: "listing.contact_reveal", targetType: "listing", targetId: "ad1", requestId: "r1" });
    const list = await listHistory(admin, parseHistoryQuery({ tab: "audit", days: "0" }));
    expect(list.rows[0]).toMatchObject({ title: "A visitor showed a phone number", label: "An ad", who: "A visitor" });
    expect(JSON.stringify(list.rows[0])).not.toContain("listing.contact_reveal");
    const csv = await historyCsv(admin, parseHistoryQuery({ tab: "audit", days: "0" }));
    expect(csv).toContain("A visitor showed a phone number");
    expect(csv).not.toContain("listing.contact_reveal");
  });

  it("the sentences that staff changes write say fields in words, so no change reads like code", async () => {
    const plan = await PromotionProduct.create({ code: "bump", name: "Bump", description: "Moves the ad up", amount: 49, currency: "INR", durationDays: 1 });
    const done = await updatePlan(admin, { id: String(plan._id), name: "Bump", description: "Moves the ad up", amount: 49, durationHours: 36, shown: false });
    expect(done.summary).toBe("Saved Bump");
    const row = await AuditEvent.findOne({ action: "plan.update" }).lean();
    expect(row?.summary).toBe("Changed Bump: Lasts (hours), Shown");
    const detail = await historyDetail(admin, String(row?._id));
    expect(detail?.row.title).toBe("Changed Bump: Lasts (hours), Shown");
    expect(detail?.before).toMatchObject({ enabled: true });
    expect(detail?.after).toMatchObject({ durationHours: 36, enabled: false });
  });
});
