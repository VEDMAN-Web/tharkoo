import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export const CONTENT_KINDS = ["blog", "help", "legal", "landing", "listingIntro", "author", "blogCategory"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_STATUSES = ["draft", "review", "scheduled", "published", "unpublished"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentFields {
  title: string;
  h1?: string;
  excerpt?: string;
  body?: unknown;
  faq?: { q: string; a: string }[];
  seo?: { title?: string; description?: string; canonical?: string; noindex?: boolean; imageMediaId?: Types.ObjectId };
  coverMediaId?: Types.ObjectId;
  authorId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  tags?: string[];
  helpSection?: string;
  order?: number;
  related?: { posts?: Types.ObjectId[]; paths?: string[] };
}

export interface ContentItemDoc {
  _id?: Types.ObjectId;
  kind: ContentKind;
  slug: string;
  path?: string;
  draft: ContentFields;
  published: ContentFields | null;
  version: number;
  status: ContentStatus;
  scheduled?: { version: number; at: Date } | null;
  publishedAt?: Date;
  updatedVisibleAt?: Date;
  unpublish?: { mode: "redirect" | "gone"; to?: string } | null;
  reviewNote?: string;
  authorUserId?: Types.ObjectId;
  lastEditedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContentRevisionDoc {
  _id?: Types.ObjectId;
  itemId: Types.ObjectId;
  version: number;
  fields: ContentFields;
  status: ContentStatus;
  by: string;
  note?: string;
  createdAt?: Date;
}

const contentItemSchema = new Schema<ContentItemDoc>(
  {
    kind: { type: String, enum: CONTENT_KINDS, required: true },
    slug: { type: String, required: true },
    path: { type: String },
    draft: { type: Schema.Types.Mixed, default: () => ({ title: "" }) },
    published: { type: Schema.Types.Mixed, default: null },
    version: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: CONTENT_STATUSES, default: "draft" },
    scheduled: { type: new Schema({ version: Number, at: Date }, { _id: false }), default: null },
    publishedAt: { type: Date },
    updatedVisibleAt: { type: Date },
    unpublish: {
      type: new Schema({ mode: { type: String, enum: ["redirect", "gone"], required: true }, to: String }, { _id: false }),
      default: null,
    },
    reviewNote: { type: String },
    authorUserId: { type: Schema.Types.ObjectId },
    lastEditedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: collectionName("content_items", "ContentItem") },
);
contentItemSchema.index({ kind: 1, slug: 1 }, { unique: true });
contentItemSchema.index({ path: 1 }, { unique: true, sparse: true });
contentItemSchema.index({ kind: 1, status: 1, publishedAt: -1 });
contentItemSchema.index({ status: 1, "scheduled.at": 1 });

const revisionCollection = collectionName("content_revisions", "ContentRevision");
const contentRevisionSchema = new Schema<ContentRevisionDoc>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true, min: 1 },
    fields: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: CONTENT_STATUSES, required: true },
    by: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: revisionCollection },
);
contentRevisionSchema.index({ itemId: 1, version: 1 }, { unique: true });
appendOnlyPlugin(contentRevisionSchema, revisionCollection);

export const ContentItem = registerModel<ContentItemDoc>(modelName("ContentItem"), contentItemSchema);
export const ContentRevision = registerModel<ContentRevisionDoc>(modelName("ContentRevision"), contentRevisionSchema);
lockBulkWrites(ContentRevision, revisionCollection);
