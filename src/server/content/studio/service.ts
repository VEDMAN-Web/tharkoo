import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { safeHref } from "@/lib/sanitize";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateKey } from "@/server/http";
import { CONTENT_KINDS, ContentItem, ContentRevision, type ContentFields, type ContentItemDoc, type ContentKind } from "@/server/models/content";
import { toSlug } from "@/server/shared/slug";
import { checkFields, placeholderIn, reviveFields, toPlain } from "./fields";

/**
 * H8.28 (A28): the core of the content studio. Create, save a draft, publish, unpublish and restore a version on ContentItem and
 * ContentRevision. Every write goes through adminWrite (permission, audit). Publish and unpublish can be undone (kind content.publish)
 * and the undo restores only from the data saved with the event. Editing a published item edits its `draft`; `published` stays live
 * until the next publish. Revisions are appended and never changed.
 */

/** Kinds only an admin may write: legal text and authors. */
const ADMIN_KINDS: readonly ContentKind[] = ["legal", "author"];

export type ContentWrite = { eventId: string; undoUntil: string | null; summary: string; itemId: string };

export function canWriteKind(roles: readonly string[], kind: ContentKind): boolean {
  return ADMIN_KINDS.includes(kind) ? can(roles, "content.legal") : can(roles, "content.write");
}

/** A blog editor writes and sends for review but does not publish, unless they also hold a role that can. */
export function canPublishKind(roles: readonly string[], kind: ContentKind): boolean {
  if (ADMIN_KINDS.includes(kind)) return can(roles, "content.legal");
  const publisher = roles.some((role) => role === "seo_editor" || role === "admin" || role === "superadmin");
  return publisher && can(roles, "content.publish");
}

async function load(itemId: string) {
  await connectDb();
  if (!mongoose.isValidObjectId(itemId)) throw new NotFoundError("Not found");
  const item = await ContentItem.findById(itemId).lean<(ContentItemDoc & { _id: mongoose.Types.ObjectId }) | null>();
  if (!item) throw new NotFoundError("Not found");
  return item;
}

function requireWrite(ctx: AdminCtx, kind: ContentKind) {
  if (!canWriteKind(ctx.roles, kind)) throw new ForbiddenError("You do not have permission to do this");
}

function requirePublish(ctx: AdminCtx, kind: ContentKind) {
  if (!canPublishKind(ctx.roles, kind)) throw new ForbiddenError(ctx.roles.includes("blog_editor") ? "A blog editor sends posts for review. An editor or admin publishes them." : "You do not have permission to do this");
}

/** Creates an empty draft. The slug comes from the title unless one is given; a listing intro needs the page path it belongs to. */
export async function createItem(ctx: AdminCtx, input: { kind: string; title: string; slug?: string; path?: string }): Promise<ContentWrite> {
  await connectDb();
  const kind = CONTENT_KINDS.find((candidate) => candidate === input.kind);
  if (!kind) throw new ValidationError("Choose what you are writing.");
  requireWrite(ctx, kind);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 1 || title.length > 200) throw new ValidationError("Write a title of 1 to 200 characters.");
  const fields = checkFields({ title });
  const slug = toSlug(input.slug?.trim() || title);
  const path = input.path?.trim();
  if (kind === "listingIntro" && !(path && /^\/[a-z0-9\-/]{1,200}$/i.test(path))) throw new ValidationError("A listing intro needs the page it belongs to, for example /jobs/mumbai/.");
  if (kind !== "listingIntro" && path) throw new ValidationError("Only a listing intro has a page path.");
  const written = await adminWrite(ctx, {
    perm: "content.write",
    action: "content.create",
    target: { type: "content", id: slug, label: title },
    texts: [title],
    before: async () => null,
    apply: async () => {
      try {
        const doc = await ContentItem.create({ kind, slug, ...(path ? { path } : {}), draft: fields, published: null, version: 1, status: "draft", lastEditedBy: ctx.email, authorUserId: new mongoose.Types.ObjectId(ctx.actorId) });
        return { after: { kind, slug, title }, result: String(doc._id), summary: `Started the ${kind} "${title}"` };
      } catch (error) {
        if (isDuplicateKey(error)) throw new ConflictError("Something with this address already exists. Change the title or the address.");
        throw error;
      }
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Started "${title}"`, itemId: written.result };
}

/**
 * Saves the draft. Saving never changes what the public sees. An item that was waiting for review or scheduled goes back to draft,
 * so nothing goes live that its editor has since changed. `expectedVersion` stops two people overwriting each other.
 */
export async function saveDraft(ctx: AdminCtx, input: { itemId: string; fields: unknown; expectedVersion?: number }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  requireWrite(ctx, item.kind);
  const fields = checkFields(input.fields);
  if (input.expectedVersion !== undefined && input.expectedVersion !== item.version) throw new ConflictError("Someone saved this a moment ago. Open it again to see their changes.");
  const back = item.status === "review" || item.status === "scheduled";
  const written = await adminWrite(ctx, {
    perm: ADMIN_KINDS.includes(item.kind) ? "content.legal" : "content.write",
    action: "content.save",
    target: { type: "content", id: String(item._id), label: fields.title },
    texts: [fields.title],
    before: async () => ({ title: item.draft?.title ?? "", status: item.status }),
    apply: async () => {
      const set: Record<string, unknown> = { draft: fields, lastEditedBy: ctx.email };
      if (back) set.status = "draft";
      const update = await ContentItem.updateOne({ _id: item._id, version: item.version }, { $set: set, ...(back ? { $unset: { scheduled: "" } } : {}) });
      if (update.matchedCount !== 1) throw new ConflictError("Someone saved this a moment ago. Open it again to see their changes.");
      return { after: { title: fields.title, status: back ? "draft" : item.status }, result: null, summary: `Saved the draft of "${fields.title}"` };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved "${fields.title}"`, itemId: String(item._id) };
}

type BeforeState = { status: string; published: unknown; publishedAt: string | null; updatedVisibleAt: string | null; unpublish: unknown; scheduled: unknown };

function beforeStateOf(item: ContentItemDoc): BeforeState {
  return toPlain({
    status: item.status,
    published: item.published,
    publishedAt: item.publishedAt ?? null,
    updatedVisibleAt: item.updatedVisibleAt ?? null,
    unpublish: item.unpublish ?? null,
    scheduled: item.scheduled ?? null,
  }) as BeforeState;
}

/** Publishes the draft: it becomes the live text, a revision is appended, and the change can be undone. Refused while a "[placeholder" marker is left in the text. */
export async function publishItem(ctx: AdminCtx, input: { itemId: string; note?: string }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  requirePublish(ctx, item.kind);
  const fields = checkFields(toPlain(item.draft));
  if (placeholderIn(fields)) throw new ValidationError("This text still has a [placeholder ...] or [ADD FACT] marker. Replace it with the real fact before publishing.");
  const before = beforeStateOf(item);
  const now = new Date();
  const written = await adminWrite(ctx, {
    perm: ADMIN_KINDS.includes(item.kind) ? "content.legal" : "content.publish",
    action: "content.publish",
    target: { type: "content", id: String(item._id), label: fields.title },
    reason: input.note,
    texts: [fields.title, input.note],
    undo: { kind: "content.publish", windowKey: "edits" },
    before: async () => ({ status: item.status, version: item.version }),
    apply: async () => {
      const claimed = await ContentItem.findOneAndUpdate(
        { _id: item._id, version: item.version },
        { $set: { aiDraft: false, published: fields, status: "published", publishedAt: item.publishedAt ?? now, updatedVisibleAt: now, unpublish: null, scheduled: null, lastEditedBy: ctx.email }, $inc: { version: 1 } },
        { returnDocument: "after" },
      ).lean();
      if (!claimed) throw new ConflictError("Someone changed this a moment ago. Open it again and publish once more.");
      await ContentRevision.create({ itemId: item._id, version: item.version, fields, status: "published", by: ctx.email, note: input.note ?? "" });
      return {
        after: { status: "published", version: item.version + 1, title: fields.title },
        result: null,
        summary: `Published "${fields.title}"`,
        undoData: { itemId: String(item._id), before, afterVersion: item.version + 1 },
      };
    },
  });
  await refreshPublicCache("content studio");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Published "${fields.title}"`, itemId: String(item._id) };
}

/** Takes a published or scheduled item off the site. The address either goes to another page of this site or says it is gone. Undo puts the live text back. */
export async function unpublishItem(ctx: AdminCtx, input: { itemId: string; mode: string; to?: string }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  requirePublish(ctx, item.kind);
  if (item.status !== "published" && item.status !== "scheduled") throw new ConflictError("Only a published or scheduled item can be taken off the site.");
  if (input.mode !== "redirect" && input.mode !== "gone") throw new ValidationError("Choose where visitors go: another page, or a page that says it is gone.");
  const to = input.mode === "redirect" ? safeHref(input.to) : "";
  if (input.mode === "redirect" && !(to && to.startsWith("/"))) throw new ValidationError("A redirect goes to a page on this site, for example /blog/.");
  const before = beforeStateOf(item);
  const title = item.draft?.title ?? item.published?.title ?? "";
  const written = await adminWrite(ctx, {
    perm: ADMIN_KINDS.includes(item.kind) ? "content.legal" : "content.publish",
    action: "content.unpublish",
    target: { type: "content", id: String(item._id), label: title },
    undo: { kind: "content.publish", windowKey: "edits" },
    before: async () => ({ status: item.status, version: item.version }),
    apply: async () => {
      const unpublish = input.mode === "redirect" ? { mode: "redirect" as const, to } : { mode: "gone" as const };
      const claimed = await ContentItem.findOneAndUpdate({ _id: item._id, version: item.version }, { $set: { status: "unpublished", unpublish, scheduled: null, lastEditedBy: ctx.email }, $inc: { version: 1 } }, { returnDocument: "after" }).lean();
      if (!claimed) throw new ConflictError("Someone changed this a moment ago. Open it again.");
      await ContentRevision.create({ itemId: item._id, version: item.version, fields: item.published ?? item.draft, status: "unpublished", by: ctx.email, note: input.mode === "redirect" ? `Redirects to ${to}` : "Gone" });
      return { after: { status: "unpublished", mode: input.mode, to: to || null }, result: null, summary: `Took "${title}" off the site`, undoData: { itemId: String(item._id), before, afterVersion: item.version + 1 } };
    },
  });
  await refreshPublicCache("content studio");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Took "${title}" off the site`, itemId: String(item._id) };
}

/** Puts an earlier version into the draft. Nothing goes live: the editor reads it, changes it if they like, and publishes. */
export async function restoreRevision(ctx: AdminCtx, input: { itemId: string; version: number }): Promise<ContentWrite> {
  await connectDb();
  const item = await load(input.itemId);
  requireWrite(ctx, item.kind);
  if (!Number.isInteger(input.version) || input.version < 1) throw new ValidationError("Choose a version.");
  const revision = await ContentRevision.findOne({ itemId: item._id, version: input.version }).lean<{ fields: unknown } | null>();
  if (!revision) throw new NotFoundError("That version does not exist");
  const fields: ContentFields = reviveFields(toPlain(revision.fields));
  const back = item.status === "review" || item.status === "scheduled";
  const written = await adminWrite(ctx, {
    perm: ADMIN_KINDS.includes(item.kind) ? "content.legal" : "content.write",
    action: "content.restore",
    target: { type: "content", id: String(item._id), label: fields.title },
    before: async () => ({ title: item.draft?.title ?? "" }),
    apply: async () => {
      const update = await ContentItem.updateOne({ _id: item._id, version: item.version }, { $set: { draft: fields, lastEditedBy: ctx.email, ...(back ? { status: "draft" } : {}) }, ...(back ? { $unset: { scheduled: "" } } : {}) });
      if (update.matchedCount !== 1) throw new ConflictError("Someone changed this a moment ago. Open it again.");
      return { after: { title: fields.title, fromVersion: input.version }, result: null, summary: `Put version ${input.version} of "${fields.title}" into the draft` };
    },
  });
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Version ${input.version} is in the draft`, itemId: String(item._id) };
}
