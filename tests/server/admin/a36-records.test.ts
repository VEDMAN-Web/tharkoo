import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

vi.mock("@/lib/cache", () => ({ refreshPublicCache: async () => undefined }));

import { emptyValues, KINDS, RECORD_KINDS } from "@/lib/admin/record-kinds";
import type { AdminCtx } from "@/server/admin/context";
import { deleteRecord, getRecord, listRecords, parseRecordsQuery, saveRawRecord, saveRecord } from "@/server/admin/records";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Banner, BannedWord, FeatureFlag, HelpArticle } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctx = (roles: string[]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "staff@example.test", roles, requestId: "r" });
const admin = ctx(["admin"]);
const superadmin = ctx(["superadmin"]);
const query = (changes: Partial<ReturnType<typeof parseRecordsQuery>> = {}) => ({ ...parseRecordsQuery({}), ...changes });

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

const notice = { title: "Diwali offer", body: "Extra credits this week.", slot: "top-bar", href: "/prices/", cta: "See offers", order: 1, enabled: true };
const article = { title: "How to post", slug: "how-to-post", section: "Getting started", order: 1, status: "published", body: "Step one." };

describe("the four record screens", () => {
  it("describe every field they save, and a new record starts from sensible values", () => {
    for (const kind of RECORD_KINDS) {
      const config = KINDS[kind];
      const empty = emptyValues(config);
      expect(Object.keys(empty).sort()).toEqual(config.fields.map((field) => field.name).sort());
      expect(config.schema.safeParse(empty).success).toBe(false);
    }
    expect(emptyValues(KINDS["banned-words"])).toMatchObject({ matchType: "contains", scope: "all", action: "block" });
  });

  it("checks each form on the server with a plain message per field", async () => {
    const bad = async (kind: keyof typeof KINDS, values: Record<string, unknown>, field: string) => {
      const error = await saveRecord(admin, kind, { values }).catch((caught) => caught);
      expect(error, `${kind} ${field}`).toBeInstanceOf(ValidationError);
      expect(error.fields?.[field]).toBeTruthy();
    };
    await bad("banned-words", { text: "  ", matchType: "contains", scope: "all", action: "block" }, "text");
    await bad("broadcasts", { ...notice, href: "javascript:alert(1)" }, "href");
    await bad("broadcasts", { ...notice, href: "//elsewhere.test" }, "href");
    await bad("broadcasts", { ...notice, title: "" }, "title");
    await bad("help-sections", { ...article, slug: "Not A Slug" }, "slug");
    await bad("help-sections", { ...article, status: "maybe" }, "status");
    await expect(saveRecord(superadmin, "flags", { values: { key: "Payments On", label: "Payments", enabled: true } })).rejects.toBeInstanceOf(ValidationError);
    expect(await BannedWord.countDocuments()).toBe(0);
  });
});

describe("saving, undoing and deleting", () => {
  it("creates a record, logs it, and changes it with an undo that puts the old values back", async () => {
    const created = await saveRecord(admin, "broadcasts", { values: notice });
    expect(created).toMatchObject({ created: true, name: "Diwali offer" });
    expect(await AuditEvent.findById(created.eventId).lean()).toMatchObject({ action: "banner.create", targetType: "Banner", targetId: "new" });
    const id = created.id;
    const changed = await saveRecord(admin, "broadcasts", { id, values: { ...notice, title: "Diwali offer 2", enabled: false } });
    expect(changed.created).toBe(false);
    expect(await Banner.findById(id).lean()).toMatchObject({ title: "Diwali offer 2", enabled: false });
    expect(await AuditEvent.findById(changed.eventId).lean()).toMatchObject({ action: "banner.update", undo: { kind: "record.restore" } });
    expect(await undoEvent(admin, changed.eventId)).toMatchObject({ ok: true });
    expect(await Banner.findById(id).lean()).toMatchObject({ title: "Diwali offer", enabled: true });
  });

  it("keeps a flag key fixed after it is created and refuses a second record with the same key", async () => {
    const first = await saveRecord(superadmin, "flags", { values: { key: "chat.live", label: "Live chat", enabled: true } });
    await saveRecord(superadmin, "flags", { id: first.id, values: { key: "other.key", label: "Live chat on", enabled: false } });
    expect(await FeatureFlag.findById(first.id).lean()).toMatchObject({ key: "chat.live", label: "Live chat on", enabled: false });
    await expect(saveRecord(superadmin, "flags", { values: { key: "chat.live", label: "Again", enabled: true } })).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a blocked word in a notice or an article, but a banned word may hold one", async () => {
    await expect(saveRecord(admin, "broadcasts", { values: { ...notice, body: "blockedword here" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRecord(admin, "help-sections", { values: { ...article, body: "blockedword" } })).rejects.toBeInstanceOf(ValidationError);
    expect(await saveRecord(admin, "banned-words", { values: { text: "blockedword", matchType: "contains", scope: "all", action: "block" } })).toMatchObject({ created: true });
  });

  it("deletes with a log row and no undo, and says so when the record is gone", async () => {
    const made = await saveRecord(admin, "banned-words", { values: { text: "spamword", matchType: "whole", scope: "ads", action: "review" } });
    const done = await deleteRecord(admin, "banned-words", made.id);
    expect(done.name).toBe("spamword");
    expect(await BannedWord.findById(made.id).lean()).toBeNull();
    expect(await AuditEvent.findOne({ action: "bannedword.delete" }).lean()).toMatchObject({ targetId: made.id, lock: "purged" });
    await expect(deleteRecord(admin, "banned-words", made.id)).rejects.toThrow("Record not found");
  });
});

describe("roles and raw data", () => {
  it("lets the right team in and nobody else, with a denial in the log", async () => {
    await expect(saveRecord(ctx(["support"]), "banned-words", { values: { text: "x", matchType: "contains", scope: "all", action: "block" } })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRecord(ctx(["moderator"]), "broadcasts", { values: notice })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRecord(admin, "flags", { values: { key: "a.b", label: "A", enabled: true } })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(3);
    expect(await BannedWord.countDocuments()).toBe(0);
    await expect(saveRecord(ctx(["seo_editor"]), "help-sections", { values: article })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(4);
    const made = await saveRecord(admin, "help-sections", { values: article });
    const changed = await saveRecord(admin, "help-sections", { id: made.id, values: { ...article, title: "How to post an ad" } });
    expect(await undoEvent(admin, changed.eventId)).toMatchObject({ ok: true });
    expect((await HelpArticle.findById(made.id).lean())?.title).toBe("How to post");
  });

  it("opens and lists only for the roles that may see the screen", async () => {
    await expect(listRecords(["support"], "banned-words", query())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listRecords(["admin"], "flags", query())).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listRecords(["superadmin"], "flags", query())).total).toBe(0);
  });

  it("shows raw JSON to a superadmin only and saves it through the write helper with an undo", async () => {
    const made = await saveRecord(admin, "broadcasts", { values: notice });
    expect((await getRecord(["admin"], "broadcasts", made.id)).raw).toBeNull();
    const detail = await getRecord(["superadmin"], "broadcasts", made.id);
    expect(detail.raw).toContain('"title": "Diwali offer"');
    expect(detail.raw).not.toContain("_id");
    await expect(saveRawRecord(admin, "broadcasts", made.id, '{"title":"x"}')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveRawRecord(superadmin, "broadcasts", made.id, "{nope")).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRawRecord(superadmin, "broadcasts", made.id, "[1]")).rejects.toBeInstanceOf(ValidationError);
    const saved = await saveRawRecord(superadmin, "broadcasts", made.id, JSON.stringify({ _id: "x", title: "Raw title", extra: "dropped" }));
    expect(await Banner.findById(made.id).lean()).toMatchObject({ title: "Raw title" });
    expect(await undoEvent(superadmin, saved.eventId)).toMatchObject({ ok: true });
    expect((await Banner.findById(made.id).lean())?.title).toBe("Diwali offer");
  });
});

describe("the list", () => {
  it("searches, sorts and pages on the server", async () => {
    for (let index = 0; index < 30; index += 1) await saveRecord(admin, "banned-words", { values: { text: `word ${String(index).padStart(2, "0")}`, matchType: "contains", scope: "all", action: "block" } });
    await saveRecord(admin, "banned-words", { values: { text: "needle", matchType: "contains", scope: "all", action: "block" } });
    const first = await listRecords(["admin"], "banned-words", query());
    const second = await listRecords(["admin"], "banned-words", query({ page: 2 }));
    expect([first.total, first.rows.length, second.rows.length]).toEqual([31, 25, 6]);
    expect(first.rows[0].values.text).toBe("needle");
    expect((await listRecords(["admin"], "banned-words", query({ q: "NEEDLE" }))).rows.map((row) => row.values.text)).toEqual(["needle"]);
    expect((await listRecords(["admin"], "banned-words", query({ q: "(" }))).total).toBe(0);
    expect(parseRecordsQuery({ size: "50", page: "3", q: " a " })).toEqual({ q: "a", page: 3, pageSize: 50 });
  });
});
