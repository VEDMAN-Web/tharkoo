import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ContentItem, ContentRevision, type ContentFields, type ContentKind } from "@/server/models/content";

/**
 * H8.28: what the public may see of a content item, decided at READ time, so a scheduled item appears after its time with no
 * background job. The cron of A34 only tidies up (cache, sitemap, audit row); it is never what makes the item visible.
 */

export type PublicContent =
  | { state: "published"; fields: ContentFields; publishedAt: Date | null; updatedAt: Date | null }
  | { state: "redirect"; to: string }
  | { state: "gone" }
  | { state: "missing" };

type ItemLean = {
  _id: Types.ObjectId;
  status: string;
  published: ContentFields | null;
  publishedAt?: Date;
  updatedVisibleAt?: Date;
  scheduled?: { version: number; at: Date } | null;
  unpublish?: { mode: "redirect" | "gone"; to?: string } | null;
};

/** The fields to show right now, or null when the item is not visible. Pure: the caller loads the scheduled revision when it is due. */
export function dueScheduled(item: Pick<ItemLean, "status" | "scheduled">, now: Date): { version: number } | null {
  return item.status === "scheduled" && item.scheduled && item.scheduled.at.getTime() <= now.getTime() ? { version: item.scheduled.version } : null;
}

/** One item for a public page. A published item shows its published fields (never its draft). A scheduled item shows its scheduled revision once its time has come. */
export async function readPublicContent(kind: ContentKind, slug: string, now: Date = new Date()): Promise<PublicContent> {
  await connectDb();
  const item = await ContentItem.findOne({ kind, slug }).lean<ItemLean | null>();
  if (!item) return { state: "missing" };
  if (item.status === "published" && item.published) return { state: "published", fields: item.published, publishedAt: item.publishedAt ?? null, updatedAt: item.updatedVisibleAt ?? item.publishedAt ?? null };
  const due = dueScheduled(item, now);
  if (due) {
    const revision = await ContentRevision.findOne({ itemId: item._id, version: due.version }).lean<{ fields: ContentFields } | null>();
    if (revision) return { state: "published", fields: revision.fields, publishedAt: item.scheduled?.at ?? null, updatedAt: item.scheduled?.at ?? null };
  }
  if (item.status === "unpublished" && item.unpublish) return item.unpublish.mode === "redirect" && item.unpublish.to ? { state: "redirect", to: item.unpublish.to } : { state: "gone" };
  return { state: "missing" };
}

/** Whether an item is visible to the public at this moment (used by lists and the sitemap). */
export async function isVisibleNow(itemId: string, now: Date = new Date()): Promise<boolean> {
  await connectDb();
  const item = await ContentItem.findById(itemId).lean<ItemLean | null>();
  if (!item) return false;
  return (item.status === "published" && Boolean(item.published)) || dueScheduled(item, now) !== null;
}
