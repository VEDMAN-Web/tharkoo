import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as cronPost } from "@/app/api/cron/content-publish/route";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { readPublicContent } from "@/server/content/studio/read";
import { createItem, publishItem, saveDraft } from "@/server/content/studio/service";
import { approveAndSchedule, finalizeDue, parseScheduleTime, sendBack, submitForReview } from "@/server/content/studio/workflow";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, ContentItem, ContentRevision } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const writer: AdminCtx = { actorId: "000000000000000000000081", email: "kavya@example.com", roles: ["blog_editor"], requestId: "r-w" };
const editor: AdminCtx = { actorId: "000000000000000000000082", email: "meera@example.com", roles: ["seo_editor"], requestId: "r-e" };
const support: AdminCtx = { actorId: "000000000000000000000083", email: "s@example.com", roles: ["support"], requestId: "r-s" };

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CRON_SECRET = "test-cron-secret-value";
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function draft(title = "Renting a flat", body = "Look at the ads.") {
  const made = await createItem(writer, { kind: "blog", title });
  await saveDraft(writer, { itemId: made.itemId, fields: { title, body: { v: 1, nodes: [{ t: "p", text: body }] } } });
  return made.itemId;
}

const statusOf = async (id: string) => (await ContentItem.findById(id).lean())?.status;

describe("send for review and send back", () => {
  it("a writer sends a draft for review, a reviewer sends it back with a note, and editing a reviewed item returns it to draft", async () => {
    const id = await draft();
    const sent = await submitForReview(writer, { itemId: id, note: "Please check the deposit part" });
    expect(await statusOf(id)).toBe("review");
    expect((await ContentItem.findById(id).lean())?.reviewNote).toBe("Please check the deposit part");
    await expect(submitForReview(writer, { itemId: id })).rejects.toBeInstanceOf(ConflictError);
    await expect(sendBack(editor, { itemId: id, note: "" })).rejects.toBeInstanceOf(ValidationError);
    await sendBack(editor, { itemId: id, note: "Add the owner's phone rule" });
    expect(await statusOf(id)).toBe("draft");
    expect((await ContentItem.findById(id).lean())?.reviewNote).toBe("Add the owner's phone rule");
    await submitForReview(writer, { itemId: id });
    await saveDraft(writer, { itemId: id, fields: { title: "Renting a flat today" } });
    expect(await statusOf(id)).toBe("draft");
    expect(sent.eventId).toBeTruthy();
  });

  it("only people who may write can send for review and only publishers can send back; a placeholder marker stops the sending", async () => {
    const id = await draft();
    await expect(submitForReview(support, { itemId: id })).rejects.toBeInstanceOf(ForbiddenError);
    await submitForReview(writer, { itemId: id });
    await expect(sendBack(writer, { itemId: id, note: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(sendBack(support, { itemId: id, note: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    const marked = await draft("Marked", "Fill in [placeholder address] here");
    await expect(submitForReview(writer, { itemId: marked })).rejects.toBeInstanceOf(ValidationError);
    expect(await statusOf(marked)).toBe("draft");
  });

  it("each step can be undone from its saved data, and a second undo is refused", async () => {
    const id = await draft();
    const sent = await submitForReview(writer, { itemId: id });
    expect(await undoEvent(writer, sent.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(await undoEvent(editor, sent.eventId)).toMatchObject({ ok: true });
    expect(await statusOf(id)).toBe("draft");
    expect(await undoEvent(editor, sent.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
    const again = await submitForReview(writer, { itemId: id });
    const back = await sendBack(editor, { itemId: id, note: "Needs work" });
    expect(await statusOf(id)).toBe("draft");
    expect(await undoEvent(editor, back.eventId)).toMatchObject({ ok: true });
    expect(await statusOf(id)).toBe("review");
    expect(again.eventId).toBeTruthy();
  });
});

describe("approve and schedule", () => {
  it("a blog editor cannot approve or publish; an editor can, and the time must be ahead", async () => {
    const id = await draft();
    await submitForReview(writer, { itemId: id });
    await expect(approveAndSchedule(writer, { itemId: id, at: minutes(10).toISOString() })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(publishItem(writer, { itemId: id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(approveAndSchedule(editor, { itemId: id, at: "not a date" })).rejects.toBeInstanceOf(ValidationError);
    await expect(approveAndSchedule(editor, { itemId: id, at: minutes(-5).toISOString() })).rejects.toBeInstanceOf(ValidationError);
    await expect(approveAndSchedule(editor, { itemId: id, at: minutes(0.2).toISOString() })).rejects.toBeInstanceOf(ValidationError);
    expect(parseScheduleTime(minutes(5).toISOString()).getTime()).toBeGreaterThan(Date.now());
    expect(await statusOf(id)).toBe("review");
  });

  it("keeps the approved text as a version, the public sees it only from its time, and editing it afterwards cancels the schedule", async () => {
    const id = await draft("Stay safe when you meet", "Meet in a public place.");
    await submitForReview(writer, { itemId: id });
    const at = minutes(30);
    const done = await approveAndSchedule(editor, { itemId: id, at: at.toISOString() });
    expect(done.summary).toContain("IST");
    const item = await ContentItem.findById(id).lean();
    expect(item?.status).toBe("scheduled");
    expect(new Date(item!.scheduled!.at).getTime()).toBe(at.getTime());
    expect(await ContentRevision.countDocuments({ itemId: id, status: "scheduled" })).toBe(1);
    expect((await readPublicContent("blog", "stay-safe-when-you-meet", new Date())).state).toBe("missing");
    const later = await readPublicContent("blog", "stay-safe-when-you-meet", minutes(31));
    expect(later.state).toBe("published");
    await saveDraft(editor, { itemId: id, fields: { title: "Stay safe when you meet someone new", body: { v: 1, nodes: [{ t: "p", text: "Changed after approval." }] } } });
    expect(await statusOf(id)).toBe("draft");
    expect((await readPublicContent("blog", "stay-safe-when-you-meet", minutes(31))).state).toBe("missing");
  });

  it("a reviewer can send a scheduled item back, and undo of a schedule puts it back where it was", async () => {
    const id = await draft();
    await submitForReview(writer, { itemId: id });
    const scheduled = await approveAndSchedule(editor, { itemId: id, at: minutes(20).toISOString() });
    expect(await undoEvent(editor, scheduled.eventId)).toMatchObject({ ok: true });
    expect(await statusOf(id)).toBe("review");
    expect((await ContentItem.findById(id).lean())?.scheduled ?? null).toBeNull();
    await approveAndSchedule(editor, { itemId: id, at: minutes(20).toISOString() });
    await sendBack(editor, { itemId: id, note: "Hold on" });
    const after = await ContentItem.findById(id).lean();
    expect(after?.status).toBe("draft");
    expect(after?.scheduled ?? null).toBeNull();
  });

  it("an editor may schedule a draft directly, and a marker in the text stops the schedule", async () => {
    const id = await draft();
    await approveAndSchedule(editor, { itemId: id, at: minutes(15).toISOString() });
    expect(await statusOf(id)).toBe("scheduled");
    const marked = await draft("Another", "Add [placeholder office address]");
    await expect(approveAndSchedule(editor, { itemId: marked, at: minutes(15).toISOString() })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("the cron that finishes due items", () => {
  it("publishes only what is due, once, with a revision and an audit row, and a second run does nothing", async () => {
    const soon = await draft("Due soon", "Text one.");
    const far = await draft("Due far away", "Text two.");
    await approveAndSchedule(editor, { itemId: soon, at: minutes(10).toISOString() });
    await approveAndSchedule(editor, { itemId: far, at: minutes(600).toISOString() });
    expect(await finalizeDue("run-0", new Date())).toEqual({ published: 0, skipped: 0 });
    const first = await finalizeDue("run-1", minutes(11));
    expect(first).toEqual({ published: 1, skipped: 0 });
    const done = await ContentItem.findById(soon).lean();
    expect(done).toMatchObject({ status: "published" });
    expect(done?.published?.title).toBe("Due soon");
    expect(done?.scheduled ?? null).toBeNull();
    expect(await statusOf(far)).toBe("scheduled");
    expect(await ContentRevision.countDocuments({ itemId: soon, status: "published" })).toBe(1);
    const row = await AuditEvent.findOne({ action: "content.publish.scheduled" }).lean();
    expect(row).toMatchObject({ targetId: soon, actorType: "worker" });
    expect(await finalizeDue("run-2", minutes(12))).toEqual({ published: 0, skipped: 0 });
    expect((await readPublicContent("blog", "due-soon", minutes(12))).state).toBe("published");
  });

  it("two runs at the same moment publish the item once", async () => {
    const id = await draft("Race", "Text.");
    await approveAndSchedule(editor, { itemId: id, at: minutes(5).toISOString() });
    const results = await Promise.all([finalizeDue("a", minutes(6)), finalizeDue("b", minutes(6)), finalizeDue("c", minutes(6))]);
    expect(results.reduce((sum, row) => sum + row.published, 0)).toBe(1);
    expect(await ContentRevision.countDocuments({ itemId: id, status: "published" })).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "content.publish.scheduled" })).toBe(1);
  });

  it("an item whose approved version is missing is skipped, not published", async () => {
    const id = await draft("Broken", "Text.");
    await approveAndSchedule(editor, { itemId: id, at: minutes(5).toISOString() });
    await ContentItem.updateOne({ _id: id }, { $set: { "scheduled.version": 99 } });
    expect(await finalizeDue("x", minutes(6))).toEqual({ published: 0, skipped: 1 });
    expect(await statusOf(id)).toBe("scheduled");
  });

  it("the route needs the secret header and answers with the counts", async () => {
    const id = await draft("Route item", "Text.");
    await approveAndSchedule(editor, { itemId: id, at: minutes(5).toISOString() });
    const call = (headers: Record<string, string>) => cronPost(new Request("http://localhost/api/cron/content-publish", { method: "POST", headers, body: "{}" }) as never);
    expect((await call({})).status).toBe(401);
    expect((await call({ "x-cron-secret": "wrong" })).status).toBe(401);
    const ok = await call({ "x-cron-secret": "test-cron-secret-value" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ contentPublished: 0, contentSkipped: 0 });
  });
});

describe("publish now still works for a scheduled item", () => {
  it("publishing a scheduled item clears the schedule", async () => {
    const id = await draft("Now", "Text.");
    await approveAndSchedule(editor, { itemId: id, at: minutes(90).toISOString() });
    await publishItem(editor, { itemId: id });
    const item = await ContentItem.findById(id).lean();
    expect(item?.status).toBe("published");
    expect(item?.scheduled ?? null).toBeNull();
  });
});
