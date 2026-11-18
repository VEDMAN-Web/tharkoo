import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { loadUndoHandler, notBuiltHandler, overrideUndoHandler, undoSourceOf, UNDO_KINDS, type UndoHandler } from "@/server/admin/undo/registry";
import { adminWrite } from "@/server/admin/write";
import { AppendOnlyError } from "@/server/audit";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, IdentityVerification, Listing, Site } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000001", email: "admin@example.com", roles: ["admin"], requestId: "req-1" };
const support: AdminCtx = { actorId: "000000000000000000000002", email: "support@example.com", roles: ["support"], requestId: "req-2" };

const record = { value: "one", version: 1, changedBy: null as string | null };

const handler: UndoHandler = {
  canUndo: (ctx) => ctx.roles.includes("admin"),
  conflict: async (event) => {
    return record.value === event.take("expect") ? null : { changedBy: record.changedBy, at: "2026-01-01T00:00:00.000Z" };
  },
  run: async (_ctx, event) => {
    const was = record.value;
    const back = event.take<string>("value");
    record.value = back;
    record.version += 1;
    return { after: { value: record.value, version: record.version }, summary: `Restored ${back}`, undoData: { value: was, expect: back } };
  },
};

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  overrideUndoHandler("record.restore", null);
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  record.value = "one";
  record.version = 1;
  record.changedBy = null;
  overrideUndoHandler("record.restore", handler);
});

/** Undo kinds whose real handler has been built (the rest are still stubs). Add a kind here when its card lands. */
const BUILT_KINDS: readonly string[] = ["user.ban", "wallet.adjust", "record.restore", "layout.publish", "listing.decision", "report.decision", "id.decision", "content.publish", "team.roles", "user.edit", "demo.end", "listing.edit", "media.trash", "ads.move"];

type Spec = Parameters<typeof adminWrite<string>>[1];

function change(ctx: AdminCtx, next: string, extra: Partial<Spec> = {}) {
  return adminWrite<string>(ctx, {
    perm: "settings.edit",
    action: "settings.save",
    target: { type: "settings", id: "site", label: "Site settings" },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ value: record.value, version: record.version }),
    apply: async () => {
      const was = record.value;
      record.value = next;
      record.version += 1;
      return { after: { value: record.value, version: record.version }, result: next, summary: `Changed to ${next}`, undoData: { value: was, expect: next } };
    },
    ...extra,
  });
}

function days(row: { createdAt?: Date; undo?: { until: Date } }) {
  return Math.round((new Date(row.undo!.until).getTime() - new Date(row.createdAt!).getTime()) / 86_400_000);
}

describe("adminWrite", () => {
  it("refuses a role without the permission, audits the refusal and never applies", async () => {
    await expect(change(support, "two")).rejects.toBeInstanceOf(ForbiddenError);
    expect(record.value).toBe("one");
    const denied = await AuditEvent.findOne({ action: "admin.write.denied" }).lean();
    expect(denied).toMatchObject({ targetType: "settings", targetId: "site", actorRole: "support" });
    expect(denied?.after).toMatchObject({ attempted: "settings.save", perm: "settings.edit" });
  });

  it("refuses a missing reason when one is required and a reason over 500 characters", async () => {
    await expect(change(admin, "two", { reasonRequired: true, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(change(admin, "two", { reason: "x".repeat(501) })).rejects.toBeInstanceOf(ValidationError);
    expect(record.value).toBe("one");
    expect(await AuditEvent.countDocuments({})).toBe(0);
  });

  it("refuses a blocked term in any text, including nested ones", async () => {
    await expect(change(admin, "two", { texts: { title: "fine", nested: { list: ["ok", "a BlockedWord here"] } } })).rejects.toBeInstanceOf(ValidationError);
    expect(record.value).toBe("one");
    expect(await AuditEvent.countDocuments({})).toBe(0);
  });

  it("writes one audit row with before, after, summary, role, label, reason and the undo window", async () => {
    const done = await change(admin, "two", { reason: "Fixing a typo" });
    expect(done.result).toBe("two");
    expect(done.undoUntil).not.toBeNull();
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({
      action: "settings.save",
      targetType: "settings",
      targetId: "site",
      targetLabel: "Site settings",
      actorRole: "admin",
      summary: "Changed to two",
      reason: "Fixing a typo",
      requestId: "req-1",
    });
    expect(row?.before).toEqual({ value: "one", version: 1 });
    expect(row?.after).toEqual({ value: "two", version: 2 });
    expect(row?.undo?.kind).toBe("record.restore");
    expect(days(row!)).toBe(30);
  });

  it("uses the undo window saved on the site", async () => {
    await Site.collection.insertOne({ key: "default", undoWindows: { settings: 3 } });
    const done = await change(admin, "two");
    expect(days((await AuditEvent.findById(done.eventId).lean())!)).toBe(3);
  });

  it("records a lock instead of an undo window", async () => {
    const done = await change(admin, "two", { undo: { lock: "money_sent" } });
    expect(done.undoUntil).toBeNull();
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row?.lock).toBe("money_sent");
    expect(row?.undo).toBeUndefined();
  });

  it("redacts secret keys in before and after", async () => {
    const done = await change(admin, "two", {
      before: async () => ({ value: "one", token: "secret-a" }),
      apply: async () => ({ after: { value: "two", password: "secret-b" }, result: "two", summary: "x" }),
    });
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row?.before).toEqual({ value: "one", token: "[redacted]" });
    expect(row?.after).toEqual({ value: "two", password: "[redacted]" });
  });

  it("still returns the result and logs when the audit row cannot be written", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const create = vi.spyOn(AuditEvent, "create").mockRejectedValueOnce(new Error("down") as never);
    const done = await change(admin, "two");
    expect(done).toMatchObject({ result: "two", eventId: "" });
    expect(spy).toHaveBeenCalledWith("admin.audit.missing", expect.objectContaining({ action: "settings.save" }));
    create.mockRestore();
    spy.mockRestore();
  });
});

describe("undoEvent", () => {
  it("restores the earlier value, appends an undo row that points at the original and refuses a second undo", async () => {
    const done = await change(admin, "two");
    const first = await undoEvent(admin, done.eventId);
    expect(first.ok).toBe(true);
    expect(record.value).toBe("one");
    const undoRow = await AuditEvent.findById((first as { eventId: string }).eventId).lean();
    expect(undoRow).toMatchObject({ action: "settings.save.undo", summary: "Restored one" });
    expect(String(undoRow?.undoOf)).toBe(done.eventId);
    expect(undoRow?.before).toEqual({ value: "two", version: 2 });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
    expect(record.value).toBe("one");
  });

  it("redo is an undo of the undo", async () => {
    const done = await change(admin, "two");
    const undone = await undoEvent(admin, done.eventId);
    const redone = await undoEvent(admin, (undone as { eventId: string }).eventId);
    expect(redone.ok).toBe(true);
    expect(record.value).toBe("two");
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    expect(record.value).toBe("one");
  });

  it("returns a conflict when the record changed after the event", async () => {
    const done = await change(admin, "two");
    record.value = "other";
    record.version += 1;
    record.changedBy = "Someone Else";
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: false, reason: "conflict", changedBy: "Someone Else" });
    expect(record.value).toBe("other");
  });

  it("refuses a locked change, an event without undo and an unknown id", async () => {
    const locked = await change(admin, "two", { undo: { lock: "legal_record" } });
    expect(await undoEvent(admin, locked.eventId)).toMatchObject({ ok: false, reason: "locked", lock: "legal_record" });
    const plain = await AuditEvent.create({ actorType: "admin", action: "x", targetType: "t", targetId: "1", requestId: "r" });
    expect(await undoEvent(admin, String(plain._id))).toMatchObject({ ok: false, reason: "not_undoable" });
    expect(await undoEvent(admin, String(new mongoose.Types.ObjectId()))).toMatchObject({ ok: false, reason: "not_found" });
    expect(await undoEvent(admin, "not-an-id")).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses a role that may not undo and a change past its window", async () => {
    const done = await change(admin, "three");
    expect(await undoEvent({ ...admin, roles: ["support"] }, done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    await Site.collection.insertOne({ key: "default", undoWindows: { settings: 0 } });
    const short = await change(admin, "four");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await undoEvent(admin, short.eventId)).toMatchObject({ ok: false, reason: "expired" });
  });

  it("answers not built for a kind whose handler is still a stub", async () => {
    overrideUndoHandler("media.trash", notBuiltHandler("media.trash"));
    const done = await change(admin, "two", { undo: { kind: "media.trash", windowKey: "demo" } });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: false, reason: "not_built" });
  });

  it("has a loadable stub for every kind", async () => {
    expect(UNDO_KINDS).toHaveLength(14);
    const event = undoSourceOf({ id: "1", action: "a", targetType: "t", targetId: "1", actorId: null, undoOf: null, createdAt: new Date() }, {});
    for (const kind of UNDO_KINDS) {
      overrideUndoHandler(kind, null);
      const loaded = await loadUndoHandler(kind);
      // A card that built its handler replaces the stub: it must still load and expose the three methods.
      if (BUILT_KINDS.includes(kind)) {
        expect([typeof loaded.canUndo, typeof loaded.conflict, typeof loaded.run]).toEqual(["function", "function", "function"]);
        continue;
      }
      await expect(loaded.run(admin, event)).rejects.toThrow("not built yet");
    }
  });
});

describe("undo restores only from the saved undo data", () => {
  it("keeps the current contact of the ad when a staff edit is undone, and the audit row shows it redacted", async () => {
    const ad = await Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      categoryId: new mongoose.Types.ObjectId(),
      cityId: new mongoose.Types.ObjectId(),
      title: "Old title",
      description: "A description",
      status: "active",
      contact: { phone: "+91 90000 00001" },
    });
    overrideUndoHandler("listing.edit", {
      canUndo: () => true,
      conflict: async () => null,
      run: async (_ctx, event) => {
        await Listing.updateOne({ _id: ad._id }, { $set: { title: event.take<string>("title") } });
        return { after: { title: event.take<string>("title") }, summary: "Title restored" };
      },
    });
    const done = await adminWrite(admin, {
      perm: "ads.edit",
      action: "listing.edit",
      target: { type: "listing", id: String(ad._id) },
      undo: { kind: "listing.edit", windowKey: "edits" },
      before: async () => ({ title: "Old title", contact: { phone: "+91 90000 00001" } }),
      apply: async () => {
        await Listing.updateOne({ _id: ad._id }, { $set: { title: "Staff title" } });
        return { after: { title: "Staff title", contact: { phone: "+91 90000 00001" } }, result: true, summary: "Edited title", undoData: { title: "Old title", contact: { phone: "+91 90000 00001" } } };
      },
    });
    const saved = await AuditEvent.findById(done.eventId).lean();
    expect(saved?.before?.contact).toBe("[redacted]");
    expect(saved?.undo?.data).toEqual({ title: "Old title" });
    await Listing.updateOne({ _id: ad._id }, { $set: { contact: { phone: "+91 90000 00002" } } });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    const after = await Listing.findById(ad._id).select("+contact").lean();
    expect(after?.title).toBe("Old title");
    expect(after?.contact).toEqual({ phone: "+91 90000 00002" });
    overrideUndoHandler("listing.edit", null);
  });

  it("reopening an ID check changes the status and leaves the documents alone", async () => {
    const check = await IdentityVerification.create({
      userId: new mongoose.Types.ObjectId(),
      status: "approved",
      dateOfBirthAsserted: new Date("1995-04-02"),
      documentRef: "front-ref",
      documents: { front: "front-ref", back: "back-ref", selfie: "selfie-ref" },
    });
    overrideUndoHandler("id.decision", {
      canUndo: () => true,
      conflict: async () => null,
      run: async (_ctx, event) => {
        await IdentityVerification.updateOne({ _id: check._id }, { $set: { status: event.take<string>("status") } });
        return { after: { status: event.take<string>("status") }, summary: "Check reopened" };
      },
    });
    const done = await adminWrite(admin, {
      perm: "id.decide",
      action: "verification.decision",
      target: { type: "identity_verification", id: String(check._id) },
      undo: { kind: "id.decision", windowKey: "decisions" },
      before: async () => ({ status: "pending_review", documents: { front: "front-ref" } }),
      apply: async () => ({ after: { status: "approved" }, result: true, summary: "Approved", undoData: { status: "pending_review", documents: { front: "front-ref" }, documentRef: "front-ref" } }),
    });
    expect((await AuditEvent.findById(done.eventId).lean())?.undo?.data).toEqual({ status: "pending_review", documents: { front: "front-ref" } });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    const row = await IdentityVerification.findById(check._id).lean();
    expect(row?.status).toBe("pending_review");
    expect(row?.documentRef).toBe("front-ref");
    expect(row?.documents).toMatchObject({ front: "front-ref", back: "back-ref", selfie: "selfie-ref" });
    overrideUndoHandler("id.decision", null);
  });

  it("refuses to restore a key that is not in the saved data", async () => {
    overrideUndoHandler("record.restore", {
      canUndo: () => true,
      conflict: async () => null,
      run: async (_ctx, event) => ({ after: { title: event.take<string>("title") }, summary: "x" }),
    });
    const done = await change(admin, "two");
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: false, reason: "not_undoable" });
    expect(await AuditEvent.countDocuments({ undoOf: { $exists: true } })).toBe(0);
  });

  it("never stores secret keys in the undo data", async () => {
    const done = await change(admin, "two", {
      apply: async () => ({ after: { value: "two" }, result: "two", summary: "x", undoData: { value: "one", contact: { phone: "1" }, token: "t", selfie: "s" } }),
    });
    expect((await AuditEvent.findById(done.eventId).lean())?.undo?.data).toEqual({ value: "one" });
  });
});

describe("audit log stays append-only", () => {
  it("rejects updates and deletes of an audit row, including the new fields", async () => {
    const done = await change(admin, "two");
    await expect(AuditEvent.updateOne({ _id: done.eventId }, { $set: { summary: "edited" } })).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(AuditEvent.deleteOne({ _id: done.eventId })).rejects.toBeInstanceOf(AppendOnlyError);
    await expect(AuditEvent.updateOne({ _id: done.eventId }, { $set: { undoOf: new mongoose.Types.ObjectId() } })).rejects.toBeInstanceOf(AppendOnlyError);
  });

  it("declares the new indexes", async () => {
    const names = (await AuditEvent.collection.indexes()).map((index) => Object.keys(index.key).join(","));
    expect(names).toEqual(expect.arrayContaining(["undoOf", "batchId", "undo.until"]));
  });
});
