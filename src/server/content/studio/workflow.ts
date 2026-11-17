import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { ContentItem, ContentRevision, type ContentFields, type ContentItemDoc, type ContentKind, type ContentStatus } from "@/server/models/content";
import { checkFields, placeholderIn, toPlain } from "./fields";
import { canPublishKind, canWriteKind, type ContentWrite } from "./service";

/**
 * H8.34 (A34): the review steps of the content studio. Draft > In review > Scheduled > Published.
 * A writer (a blog editor) sends a draft for review. An editor or admin sends it back, approves it for a time, or publishes it now
 * (publishItem in service.ts). Nothing here changes what the public sees until the time comes: a scheduled item is read as live from
 * its time on (readPublicContent), and `finalizeDue` (the cron) only writes down what already happened.
 * Every step goes through adminWrite and can be undone with the content.publish undo, which restores only from the saved data.
 */

const ADMIN_KINDS: readonly ContentKind[] = ["legal", "author"];
const MIN_LEAD_MS = 60_000;
const DUE_BATCH = 50;
const NOTE_MAX = 500;

const audit = new AuditRepository();

type BeforeState = { status: ContentStatus; published: unknown; publishedAt: string | null; updatedVisibleAt: string | null; unpublish: unknown; scheduled: unknown };
type ItemLean = ContentItemDoc & { _id: mongoose.Types.ObjectId };

async function load(itemId: string): Promise<ItemLean> {
  await connectDb();
  if (!mongoose.isValidObjectId(itemId)) throw new NotFoundError("Not found");
  const item = await ContentItem.findById(itemId).lean<ItemLean | null>();
  if (!item) throw new NotFoundError("Not found");
  return item;
}

function beforeStateOf(item: ContentItemDoc): BeforeState {
  return toPlain({ status: item.status, published: item.published, publishedAt: item.publishedAt ?? null, updatedVisibleAt: item.updatedVisibleAt ?? null, unpublish: item.unpublish ?? null, scheduled: item.scheduled ?? null }) as BeforeState;
}

function writePerm(kind: ContentKind) {
  return ADMIN_KINDS.includes(kind) ? ("content.legal" as const) : ("content.write" as const);
}

function publishPerm(kind: ContentKind) {
  return ADMIN_KINDS.includes(kind) ? ("content.legal" as const) : ("content.publish" as const);
}

function cleanNote(value: unknown, required: boolean): string {
  const note = typeof value === "string" ? value.trim() : "";
  if (required && !note) throw new ValidationError("Write a short note so the writer knows what to change.");
  if (note.length > NOTE_MAX) throw new ValidationError(`Keep the note under ${NOTE_MAX} characters.`);
  return note;
}

/** The draft as it would go live, checked: blocked words, dashes and the "[placeholder" marker stop it. */
function readyFields(item: ItemLean): ContentFields {
  const fields = checkFields(toPlain(item.draft));
  if (placeholderIn(fields)) throw new ValidationError("This text still has a [placeholder ...] marker. Replace it first.");
  return fields;
}

async function move(
  ctx: AdminCtx,
  item: ItemLean,
  spec: { perm: "content.write" | "content.publish" | "content.legal"; action: string; to: ContentStatus; set: Record<string, unknown>; unset?: string[]; summary: string; revision?: { fields: ContentFields; note: string } },
): Promise<ContentWrite> {
  const before = beforeStateOf(item);
  const title = item.draft?.title ?? "";
  const written = await adminWrite(ctx, {
    perm: spec.perm,
    action: spec.action,
    target: { type: "content", id: String(item._id), label: title },
    texts: [title, spec.set.reviewNote],
    undo: { kind: "content.publish", windowKey: "edits" },
    before: async () => ({ status: item.status, version: item.version }),
    apply: async () => {
      const claimed = await ContentItem.findOneAndUpdate(
        { _id: item._id, version: item.version, status: item.status },
        { $set: { status: spec.to, lastEditedBy: ctx.email, ...spec.set }, ...(spec.unset ? { $unset: Object.fromEntries(spec.unset.map((key) => [key, ""])) } : {}), $inc: { version: 1 } },
        { returnDocument: "after" },
      ).lean();
      if (!claimed) throw new ConflictError("Someone changed this a moment ago. Open it again.");
      if (spec.revision) await ContentRevision.create({ itemId: item._id, version: item.version, fields: spec.revision.fields, status: spec.to, by: ctx.email, note: spec.revision.note });
      return { after: { status: spec.to, version: item.version + 1, title }, result: null, summary: spec.summary, undoData: { itemId: String(item._id), before, afterVersion: item.version + 1 } };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: spec.summary, itemId: String(item._id) };
}

/** A writer sends the draft for review. Only a draft can be sent. The text is checked now so the reviewer does not meet a refusal. */
export async function submitForReview(ctx: AdminCtx, input: { itemId: string; note?: string }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  if (!canWriteKind(ctx.roles, item.kind) || !can(ctx.roles, "content.write")) throw new ForbiddenError("You do not have permission to do this");
  if (item.status !== "draft") throw new ConflictError(item.status === "review" ? "This is already waiting for review." : "Only a draft can be sent for review.");
  readyFields(item);
  const note = cleanNote(input.note, false);
  const title = item.draft?.title ?? "";
  return move(ctx, item, { perm: writePerm(item.kind), action: "content.review", to: "review", set: { reviewNote: note }, summary: `Sent "${title}" for review` });
}

/** A reviewer gives an item back to its writer with a note. It works on an item in review and on one that is scheduled (the schedule is cancelled). */
export async function sendBack(ctx: AdminCtx, input: { itemId: string; note: string }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  if (!canPublishKind(ctx.roles, item.kind)) throw new ForbiddenError("You do not have permission to do this");
  if (item.status !== "review" && item.status !== "scheduled") throw new ConflictError("Only an item in review or scheduled can be sent back.");
  const note = cleanNote(input.note, true);
  const title = item.draft?.title ?? "";
  return move(ctx, item, { perm: publishPerm(item.kind), action: "content.send_back", to: "draft", set: { reviewNote: note, scheduled: null }, summary: `Sent "${title}" back to its writer` });
}

/** Parses the time a reviewer picked. It must be at least a minute ahead: for "now" the reviewer publishes at once. */
export function parseScheduleTime(value: unknown, now: Date = new Date()): Date {
  const at = typeof value === "string" || value instanceof Date ? new Date(value) : new Date(Number.NaN);
  if (Number.isNaN(at.getTime())) throw new ValidationError("Pick the day and time it goes live.");
  if (at.getTime() < now.getTime() + MIN_LEAD_MS) throw new ValidationError("Pick a time at least a minute from now. To go live at once, use Publish.");
  return at;
}

/**
 * A reviewer approves the draft for a time. The draft is kept as a version, and from that time on the public sees it, even if no
 * job runs (the read rule). Editing the draft afterwards sends it back to draft, so what was approved is what goes live.
 */
export async function approveAndSchedule(ctx: AdminCtx, input: { itemId: string; at: unknown }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  if (!canPublishKind(ctx.roles, item.kind)) throw new ForbiddenError(ctx.roles.includes("blog_editor") ? "A blog editor sends posts for review. An editor or admin approves them." : "You do not have permission to do this");
  if (item.status !== "review" && item.status !== "draft" && item.status !== "scheduled") throw new ConflictError("This item cannot be scheduled from where it is.");
  const at = parseScheduleTime(input.at);
  const fields = readyFields(item);
  const title = fields.title;
  const stamp = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const done = await move(ctx, item, {
    perm: publishPerm(item.kind),
    action: "content.schedule",
    to: "scheduled",
    set: { scheduled: { version: item.version, at }, reviewNote: "" },
    summary: `Approved "${title}" for ${stamp} IST`,
    revision: { fields, note: `Scheduled for ${at.toISOString()}` },
  });
  return done;
}

/**
 * The cron: writes down what already went live. Every due item gets its scheduled text as the published text, a revision, an audit row
 * and a cache refresh. The public already sees these items by the read rule, so a late or missed run changes nothing for visitors.
 * Safe to run twice at the same moment: an item is claimed by its status and version.
 */
export async function finalizeDue(requestId: string, now: Date = new Date()): Promise<{ published: number; skipped: number }> {
  await connectDb();
  const due = await ContentItem.find({ status: "scheduled", "scheduled.at": { $lte: now } })
    .sort({ "scheduled.at": 1 })
    .limit(DUE_BATCH)
    .lean<ItemLean[]>();
  let published = 0;
  let skipped = 0;
  for (const item of due) {
    const revision = item.scheduled ? await ContentRevision.findOne({ itemId: item._id, version: item.scheduled.version }).lean<{ fields: ContentFields } | null>() : null;
    if (!item.scheduled || !revision) {
      skipped += 1;
      continue;
    }
    const at = new Date(item.scheduled.at);
    const claimed = await ContentItem.findOneAndUpdate(
      { _id: item._id, status: "scheduled", version: item.version },
      { $set: { published: revision.fields, status: "published", publishedAt: item.publishedAt ?? at, updatedVisibleAt: at, scheduled: null, unpublish: null, lastEditedBy: "scheduled publish" }, $inc: { version: 1 } },
      { returnDocument: "after" },
    ).lean();
    if (!claimed) {
      skipped += 1;
      continue;
    }
    await ContentRevision.create({ itemId: item._id, version: item.version, fields: revision.fields, status: "published", by: "scheduled publish", note: `Went live at ${at.toISOString()}` });
    await audit.append({
      actorId: null,
      actorType: "worker",
      action: "content.publish.scheduled",
      targetType: "content",
      targetId: String(item._id),
      targetLabel: revision.fields.title,
      requestId,
      after: { status: "published", at: at.toISOString() },
      summary: `"${revision.fields.title}" went live as scheduled`,
    });
    published += 1;
  }
  if (published > 0) await refreshPublicCache("content studio");
  return { published, skipped };
}
