import { connectDb } from "@/lib/db";
import { canPublishKind } from "@/server/content/studio/service";
import { reviveFields, toPlain } from "@/server/content/studio/fields";
import { ContentItem, ContentRevision, type ContentKind, type ContentStatus } from "@/server/models/content";
import type { UndoHandler } from "../registry";

/**
 * Undo of a content publish or unpublish (H8.28). It restores ONLY from the data saved with the event: what the item looked like
 * just before (status, live text, dates, redirect). A revision is appended for the undo, so history stays complete, and the undo can
 * itself be undone (redo). It is refused when the item changed after the event.
 */

type Before = { status: ContentStatus; published: unknown; publishedAt: string | null; updatedVisibleAt: string | null; unpublish: unknown; scheduled: unknown };
type ItemLean = { _id: unknown; kind: ContentKind; version: number; status: ContentStatus; published: unknown; publishedAt?: Date; updatedVisibleAt?: Date; unpublish?: unknown; scheduled?: unknown; draft: unknown };

const STATUS_WORDS: Record<ContentStatus, string> = {
  published: "the earlier live text is back",
  unpublished: "the item is off the site",
  draft: "the item is back to a draft",
  review: "the item is back in review",
  scheduled: "the item is scheduled again",
};

const handler: UndoHandler = {
  async canUndo(ctx, event) {
    await connectDb();
    const item = await ContentItem.findById(event.targetId).select("kind").lean<{ kind: ContentKind } | null>();
    return Boolean(item) && canPublishKind(ctx.roles, (item as { kind: ContentKind }).kind);
  },

  async conflict(event) {
    await connectDb();
    const item = await ContentItem.findById(event.take<string>("itemId")).select("version").lean<{ version: number } | null>();
    if (item && item.version === event.take<number>("afterVersion")) return null;
    return { changedBy: null, at: new Date().toISOString(), message: "This was changed after you made it. Open the item to see its history." };
  },

  async run(ctx, event) {
    await connectDb();
    const itemId = event.take<string>("itemId");
    const before = event.take<Before>("before");
    const item = await ContentItem.findById(itemId).lean<ItemLean | null>();
    if (!item) throw new Error("The item is gone");
    const current = toPlain({ status: item.status, published: item.published, publishedAt: item.publishedAt ?? null, updatedVisibleAt: item.updatedVisibleAt ?? null, unpublish: item.unpublish ?? null, scheduled: item.scheduled ?? null }) as Before;
    const published = before.published ? reviveFields(before.published) : null;
    const set: Record<string, unknown> = {
      status: before.status,
      published,
      unpublish: before.unpublish ?? null,
      scheduled: before.scheduled ?? null,
      publishedAt: before.publishedAt ? new Date(before.publishedAt) : null,
      updatedVisibleAt: before.updatedVisibleAt ? new Date(before.updatedVisibleAt) : null,
      lastEditedBy: ctx.email,
    };
    const claimed = await ContentItem.findOneAndUpdate({ _id: itemId, version: item.version }, { $set: set, $inc: { version: 1 } }, { returnDocument: "after" }).lean();
    if (!claimed) throw new Error("Someone changed this a moment ago");
    await ContentRevision.create({ itemId, version: item.version, fields: published ?? (item.published as object) ?? (item.draft as object), status: before.status, by: ctx.email, note: event.undoOf ? "Applied again" : "Undo" });
    return {
      after: { status: before.status, version: item.version + 1 },
      summary: `${event.undoOf ? "Applied again" : "Undid"}: ${STATUS_WORDS[before.status]}`,
      undoData: { itemId, before: current, afterVersion: item.version + 1 },
    };
  },
};

export default handler;
