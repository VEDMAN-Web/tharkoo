import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { historyCsv, historyDetail, listHistory, parseHistoryQuery, recordHistory, typeOfAction } from "@/server/admin/history";
import { undoEvent } from "@/server/admin/undo/core";
import { notBuiltHandler, overrideUndoHandler } from "@/server/admin/undo/registry";
import { ForbiddenError } from "@/server/http";
import { AuditEvent, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const NOW = new Date("2026-06-15T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const oid = () => new mongoose.Types.ObjectId();

let staffId: mongoose.Types.ObjectId;
const ctxFor = (roles: string[], actorId = String(oid())): AdminCtx => ({ actorId, email: "me@example.test", roles, requestId: "req" });
const admin = () => ctxFor(["admin"]);
const moderator = () => ctxFor(["moderator"]);
const safety = () => ctxFor(["trust_safety"]);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
  const staff = await User.create({ email: "ayesha@example.test", passwordHash: "x", displayName: "Ayesha", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), roles: ["moderator"] });
  staffId = staff._id;
});
afterEach(() => {
  overrideUndoHandler("report.decision", null);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

function event(extra: Record<string, unknown> = {}) {
  return AuditEvent.create({
    actorType: "admin",
    actorId: staffId,
    actorRole: "moderator",
    action: "user.ban",
    targetType: "user",
    targetId: "u1",
    targetLabel: "spam.bot22",
    requestId: "r",
    summary: "Banned a user",
    createdAt: ago(HOUR),
    ...extra,
  });
}
const open = (kind: string, data?: unknown) => ({ kind, until: new Date(NOW.getTime() + DAY), ...(data === undefined ? {} : { data }) });

describe("the address (A26)", () => {
  it("reads tab, filters and paging with safe defaults", () => {
    expect(parseHistoryQuery({})).toEqual({ tab: "recent", q: "", who: "", type: "", days: 7, mine: false, page: 1, pageSize: 25 });
    expect(parseHistoryQuery({ tab: "audit", q: " ban ", who: "a".repeat(24), type: "money", days: "0", mine: "1", page: "3", size: "50" })).toEqual({
      tab: "audit", q: "ban", who: "a".repeat(24), type: "money", days: 0, mine: true, page: 3, pageSize: 50,
    });
    expect(parseHistoryQuery({ tab: "x", who: "nope", type: "x", days: "5", page: "-2", size: "7" })).toMatchObject({ tab: "recent", who: "", type: "", days: 7, page: 1, pageSize: 25 });
  });

  it("sorts actions into the types of the Type filter", () => {
    expect(["listing.reject", "user.ban", "wallet.adjust", "layout.publish", "settings.money.update", "mystery"].map(typeOfAction)).toEqual(["ads", "users", "money", "pages", "settings", "other"]);
  });
});

describe("recent changes (A26)", () => {
  it("shows staff changes with a summary, newest first, and leaves out denied attempts and rows without words", async () => {
    await event({ summary: "Older change", createdAt: ago(3 * HOUR) });
    await event({ summary: "Newer change", createdAt: ago(HOUR) });
    await event({ summary: "Tried and was refused", action: "admin.write.denied" });
    await event({ summary: undefined, action: "listing.contact_reveal" });
    const list = await listHistory(admin(), parseHistoryQuery({}), NOW);
    expect(list.rows.map((row) => row.title)).toEqual(["Newer change", "Older change"]);
    expect(list.total).toBe(2);
    expect(list.rows[0]).toMatchObject({ who: "Ayesha", role: "Moderator", label: "spam.bot22", type: "users" });
  });

  it("gives every row its state: can undo, restore, undone with Redo, locked, time passed, not for your role, not available", async () => {
    const live = await event({ summary: "Banned a user", undo: open("user.ban", { pausedListingIds: [] }) });
    const publish = await event({ summary: "Published Home page", action: "layout.publish", targetType: "layout", undo: open("layout.publish", { key: "home", scope: "default", restoreVersion: 13, atVersion: 14 }) });
    const undone = await event({ summary: "Banned another", targetId: "u2", undo: open("user.ban", { pausedListingIds: [] }), createdAt: ago(2 * HOUR) });
    const link = await event({ summary: "Undid the ban", targetId: "u2", undoOf: undone._id, createdAt: ago(HOUR / 2), undo: open("user.ban", {}) });
    await event({ summary: "Sent a refund", action: "wallet.refund", lock: "money_sent", createdAt: ago(5 * HOUR) });
    await event({ summary: "Old edit", action: "listing.edit", undo: { kind: "listing.edit", until: ago(HOUR), data: {} }, createdAt: ago(6 * HOUR) });
    await event({ summary: "Added 50 credits", action: "wallet.adjust", targetType: "user", targetId: "u3", undo: open("wallet.adjust", { delta: 50 }), createdAt: ago(7 * HOUR) });
    // Whether a kind has its real undo built changes from card to card, so this test makes one kind "not built" itself.
    overrideUndoHandler("report.decision", notBuiltHandler("report.decision"));
    await event({ summary: "Decided later", action: "report.decision", undo: open("report.decision", {}), createdAt: ago(8 * HOUR) });
    await event({ summary: "Ticked a box", action: "launch.tick", createdAt: ago(9 * HOUR) });
    const rows = new Map((await listHistory(admin(), parseHistoryQuery({}), NOW)).rows.map((row) => [row.title, row]));
    expect(rows.get("Banned a user")).toMatchObject({ state: "can_undo", actionId: String(live._id), actionLabel: "Unban" });
    expect(rows.get("Published Home page")).toMatchObject({ state: "restore", actionId: String(publish._id), actionLabel: "Restore v13" });
    expect(rows.get("Banned another")).toMatchObject({ state: "undone", actionId: String(link._id), actionLabel: "Redo" });
    expect(rows.get("Undid the ban")).toMatchObject({ state: "none", actionId: null });
    expect(rows.get("Sent a refund")).toMatchObject({ state: "locked", actionId: null, lock: { reason: "money_sent", text: "Money sent" } });
    expect(rows.get("Old edit")).toMatchObject({ state: "expired", actionId: null });
    expect(rows.get("Added 50 credits")).toMatchObject({ state: "can_undo", actionLabel: "Undo" });
    const theirs = new Map((await listHistory(safety(), parseHistoryQuery({}), NOW)).rows.map((row) => [row.title, row]));
    expect(theirs.get("Added 50 credits")).toMatchObject({ state: "not_yours", actionId: null });
    expect(theirs.get("Banned a user")).toMatchObject({ state: "can_undo" });
    expect(rows.get("Decided later")).toMatchObject({ state: "not_built", actionId: null });
    expect(rows.get("Ticked a box")).toMatchObject({ state: "none", actionId: null });
  });

  it("a redone change can be undone again", async () => {
    const original = await event({ summary: "Banned a user", undo: open("user.ban", {}) });
    const first = await event({ summary: "Undid the ban", undoOf: original._id, createdAt: ago(HOUR / 2), undo: open("user.ban", {}) });
    await event({ summary: "Banned again", undoOf: first._id, createdAt: ago(HOUR / 4), undo: open("user.ban", {}) });
    const row = (await listHistory(admin(), parseHistoryQuery({}), NOW)).rows.find((item) => item.id === String(original._id));
    expect(row).toMatchObject({ state: "can_undo", actionId: String(original._id) });
  });

  it("filters by who, type, days and words, and pages", async () => {
    const other = await User.create({ email: "meera@example.test", passwordHash: "x", displayName: "Meera", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), roles: ["seo_editor"] });
    await event({ summary: "Banned a user", createdAt: ago(HOUR) });
    await event({ summary: "Edited a page", action: "layout.publish", targetType: "layout", targetLabel: "Home page", actorId: other._id, createdAt: ago(2 * HOUR) });
    await event({ summary: "Very old", action: "listing.edit", createdAt: ago(20 * DAY) });
    const run = (params: Record<string, string>) => listHistory(admin(), parseHistoryQuery(params), NOW);
    expect((await run({})).rows.map((row) => row.title)).toEqual(["Banned a user", "Edited a page"]);
    expect((await run({ who: String(other._id) })).rows.map((row) => row.title)).toEqual(["Edited a page"]);
    expect((await run({ type: "users" })).rows.map((row) => row.title)).toEqual(["Banned a user"]);
    expect((await run({ type: "pages" })).rows.map((row) => row.title)).toEqual(["Edited a page"]);
    expect((await run({ days: "0" })).total).toBe(3);
    expect((await run({ q: "home" })).rows.map((row) => row.title)).toEqual(["Edited a page"]);
    expect((await run({ q: "(" })).total).toBe(0);
    const list = await run({});
    expect(list.actors.map((actor) => actor.name)).toEqual(["Ayesha", "Meera"]);
    expect((await run({ size: "25", page: "2" })).rows).toEqual([]);
  });

  it("'only what I can undo' keeps just the rows this person can undo now", async () => {
    await event({ summary: "Banned a user", undo: open("user.ban", {}) });
    await event({ summary: "Added 50 credits", action: "wallet.adjust", undo: open("wallet.adjust", { delta: 50 }), createdAt: ago(2 * HOUR) });
    await event({ summary: "Sent a refund", action: "wallet.refund", lock: "money_sent", createdAt: ago(3 * HOUR) });
    const mine = await listHistory(safety(), parseHistoryQuery({ mine: "1" }), NOW);
    expect(mine.rows.map((row) => row.title)).toEqual(["Banned a user"]);
    expect(mine.total).toBe(1);
  });
});

describe("the full audit log (A26)", () => {
  it("is for admins and lists every row, with or without words", async () => {
    await event({ summary: undefined, action: "listing.contact_reveal", actorType: "user", actorId: null });
    await event({ action: "admin.write.denied" });
    const list = await listHistory(admin(), parseHistoryQuery({ tab: "audit" }), NOW);
    expect(list.total).toBe(2);
    await expect(listHistory(moderator(), parseHistoryQuery({ tab: "audit" }), NOW)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listHistory(moderator(), parseHistoryQuery({}), NOW)).canSeeAudit).toBe(false);
  });
});

describe("one change and one record (A26)", () => {
  it("shows what changed, without secrets, and the earlier changes to the same record", async () => {
    await event({ summary: "Edited the title", action: "listing.edit", targetType: "listing", targetId: "ad1", createdAt: ago(3 * HOUR) });
    const row = await event({ summary: "Edited the price", action: "listing.edit", targetType: "listing", targetId: "ad1", before: { price: 100, passwordHash: "secret" }, after: { price: 120 }, reason: "typo", undo: open("listing.edit", {}) });
    await event({ summary: "Another record", targetType: "listing", targetId: "ad2" });
    const detail = await historyDetail(admin(), String(row._id), NOW);
    expect(detail?.row).toMatchObject({ title: "Edited the price", reason: "typo" });
    expect(detail?.before).toEqual({ price: 100 });
    expect(detail?.after).toEqual({ price: 120 });
    expect(detail?.earlier.map((item) => item.title)).toEqual(["Edited the title"]);
    expect(await historyDetail(admin(), "nope", NOW)).toBeNull();
    expect((await recordHistory(admin(), { targetType: "listing", targetId: "ad1" }, 50, NOW)).map((item) => item.title)).toEqual(["Edited the price", "Edited the title"]);
  });
});

describe("earlier changes (H7.164)", () => {
  it("lists only the changes made before the one that is open, newest first, never a later one", async () => {
    await event({ summary: "First edit", action: "listing.edit", targetType: "listing", targetId: "ad9", createdAt: ago(5 * HOUR) });
    await event({ summary: "Second edit", action: "listing.edit", targetType: "listing", targetId: "ad9", createdAt: ago(4 * HOUR) });
    const middle = await event({ summary: "Third edit", action: "listing.edit", targetType: "listing", targetId: "ad9", createdAt: ago(3 * HOUR) });
    await event({ summary: "Fourth edit", action: "listing.edit", targetType: "listing", targetId: "ad9", createdAt: ago(1 * HOUR) });
    const detail = await historyDetail(admin(), String(middle._id), NOW);
    expect(detail?.earlier.map((item) => item.title)).toEqual(["Second edit", "First edit"]);
    const oldest = await event({ summary: "Very first", action: "listing.edit", targetType: "listing", targetId: "ad9", createdAt: ago(9 * HOUR) });
    expect((await historyDetail(admin(), String(oldest._id), NOW))?.earlier).toEqual([]);
  });
});

describe("export (A26)", () => {
  it("writes the filtered list as CSV and quotes a cell that starts like a formula", async () => {
    await event({ summary: "=SUM(A1)", targetLabel: 'He said "hi", ok', lock: "money_sent" });
    const csv = await historyCsv(admin(), parseHistoryQuery({}), NOW);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("When (UTC),Who,Role,What,Record,Type,Reason,Locked");
    expect(lines[1]).toContain("'=SUM(A1)");
    expect(lines[1]).toContain('"He said ""hi"", ok"');
    expect(lines[1]).toContain("Money sent");
    await expect(historyCsv(moderator(), parseHistoryQuery({ tab: "audit" }), NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("undo from this screen restores only from the saved undo data (A26)", () => {
  it("a change with no saved data is refused and nothing is touched", async () => {
    const user = await User.create({ email: "spam@example.test", passwordHash: "x", displayName: "Spam", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), status: "suspended" });
    const row = await event({ targetId: String(user._id), undo: { kind: "user.ban", until: new Date(Date.now() + DAY) } });
    const outcome = await undoEvent({ ...admin(), roles: ["admin"] }, String(row._id));
    expect(outcome).toMatchObject({ ok: false, reason: "not_undoable" });
    expect((await User.findById(user._id).lean())?.status).toBe("suspended");
  });
});
