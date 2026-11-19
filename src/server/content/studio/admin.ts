import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { parseRich, richMediaIds } from "@/lib/content/rich";
import { CONTENT_STATUSES, ContentItem, ContentRevision, type ContentFields, type ContentItemDoc, type ContentKind, type ContentStatus } from "@/server/models/content";
import { SiteMedia } from "@/server/models";
import { toPlain } from "./fields";

/** H8.31: what the editor screens read. Plain JSON only (ids are strings), so it can go straight to the browser. */

export type StudioKind = "blog" | "help";
export const STUDIO_KINDS: readonly StudioKind[] = ["blog", "help"];
const LIST_LIMIT = 100;

export type ListRow = {
  id: string;
  kind: StudioKind;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  publishedAt: string | null;
  categoryName: string;
};

export type EditorItem = {
  id: string;
  kind: StudioKind;
  slug: string;
  status: ContentStatus;
  version: number;
  fields: ContentFields;
  publishedAt: string | null;
  scheduledAt: string | null;
  revisions: number;
  /** The text was first written by the AI draft tool and has not been published yet. */
  aiDraft: boolean;
  media: Record<string, { src: string; alt: string }>;
};

export type Option = { id: string; title: string };

export function parseKind(value: unknown): StudioKind {
  return value === "help" ? "help" : "blog";
}

export function parseStatus(value: unknown): ContentStatus | "" {
  return (CONTENT_STATUSES as readonly string[]).includes(String(value)) ? (value as ContentStatus) : "";
}

export async function tabCounts(): Promise<Record<StudioKind, number>> {
  await connectDb();
  const [blog, help] = await Promise.all(STUDIO_KINDS.map((kind) => ContentItem.countDocuments({ kind })));
  return { blog, help };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Items of one kind, newest change first, narrowed by a status and by words in the title. */
export async function listContent(kind: StudioKind, filter: { status?: ContentStatus | ""; q?: string }): Promise<ListRow[]> {
  await connectDb();
  const match: Record<string, unknown> = { kind };
  if (filter.status) match.status = filter.status;
  const q = (filter.q ?? "").trim().slice(0, 80);
  if (q) match["draft.title"] = new RegExp(escapeRegExp(q), "i");
  const rows = await ContentItem.find(match).sort({ updatedAt: -1 }).limit(LIST_LIMIT).lean<(ContentItemDoc & { _id: mongoose.Types.ObjectId })[]>();
  const categoryIds = [...new Set(rows.map((row) => String(row.draft?.categoryId ?? "")).filter(Boolean))];
  const categories = categoryIds.length ? await ContentItem.find({ _id: { $in: categoryIds } }).select("draft.title").lean<{ _id: mongoose.Types.ObjectId; draft?: { title?: string } }[]>() : [];
  const names = new Map(categories.map((row) => [String(row._id), row.draft?.title ?? ""]));
  return rows.map((row) => ({
    id: String(row._id),
    kind,
    title: row.draft?.title || "Untitled",
    slug: row.slug,
    status: row.status,
    updatedAt: new Date(row.updatedAt ?? row.createdAt ?? 0).toISOString(),
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    categoryName: names.get(String(row.draft?.categoryId ?? "")) ?? "",
  }));
}

/** Authors or blog categories to choose from. Empty until some exist. */
export async function options(kind: "author" | "blogCategory"): Promise<Option[]> {
  await connectDb();
  const rows = await ContentItem.find({ kind }).sort({ "draft.title": 1 }).limit(200).select("draft.title").lean<{ _id: mongoose.Types.ObjectId; draft?: { title?: string } }[]>();
  return rows.map((row) => ({ id: String(row._id), title: row.draft?.title ?? "" })).filter((row) => row.title);
}

/** One item for the editor: the draft, its status and the pictures it uses (address and description). */
export async function readEditorItem(itemId: string): Promise<EditorItem | null> {
  await connectDb();
  if (!mongoose.isValidObjectId(itemId)) return null;
  const item = await ContentItem.findById(itemId).lean<(ContentItemDoc & { _id: mongoose.Types.ObjectId }) | null>();
  if (!item || (item.kind !== "blog" && item.kind !== "help")) return null;
  const fields = toPlain(item.draft ?? { title: "" }) as ContentFields & { coverMediaId?: string; seo?: { imageMediaId?: string } };
  const body = parseRich(fields.body);
  const ids = [...new Set([fields.coverMediaId, fields.seo?.imageMediaId, ...(body ? richMediaIds(body) : [])].filter((id): id is string => typeof id === "string" && mongoose.isValidObjectId(id)))];
  const docs = ids.length ? await SiteMedia.find({ _id: { $in: ids } }).select("url alt").lean<{ _id: mongoose.Types.ObjectId; url: string; alt: string }[]>() : [];
  return {
    id: String(item._id),
    kind: item.kind as StudioKind,
    slug: item.slug,
    status: item.status,
    version: item.version,
    fields,
    publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
    scheduledAt: item.scheduled?.at ? new Date(item.scheduled.at).toISOString() : null,
    revisions: await ContentRevision.countDocuments({ itemId: item._id }),
    aiDraft: item.aiDraft === true,
    media: Object.fromEntries(docs.map((doc) => [String(doc._id), { src: doc.url, alt: doc.alt }])),
  };
}

export type { ContentKind };
