import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** The three dynamic pages. Listing pages use scopes; home and post use "default" only. */
export type PageKey = "home" | "listing" | "post";
export const PAGE_KEYS: readonly PageKey[] = ["home", "listing", "post"];

export interface BlockBase {
  id: string;
  type: string;
  visible: boolean;
  label?: string;
  devices?: ("mobile" | "desktop")[];
  startsAt?: string | null;
  endsAt?: string | null;
  props: Record<string, unknown>;
}

interface BaseDoc {
  _id?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PageLayoutDoc extends BaseDoc {
  key: PageKey;
  scope: string;
  draft: BlockBase[];
  published: BlockBase[];
  version: number;
  updatedBy: string;
  publishedBy: string;
  publishedAt: Date | null;
}

export interface PageLayoutRevisionDoc extends BaseDoc {
  key: PageKey;
  scope: string;
  version: number;
  blocks: BlockBase[];
  publishedBy: string;
  publishedAt: Date;
  note?: string;
}

export interface UiTextDoc extends BaseDoc {
  key: string;
  value: string;
  updatedBy: string;
}

export interface SiteMediaDoc extends BaseDoc {
  url: string;
  objectKey: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  tags: string[];
  uploadedBy: string;
}

export interface ListingPinDoc extends BaseDoc {
  scope: string;
  listingId: string;
  position: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy: string;
}

const pageLayoutSchema = new Schema<PageLayoutDoc>(
  {
    key: { type: String, enum: PAGE_KEYS, required: true },
    scope: { type: String, required: true, default: "default" },
    draft: { type: Schema.Types.Mixed, default: [] },
    published: { type: Schema.Types.Mixed, default: [] },
    version: { type: Number, default: 0 },
    updatedBy: { type: String, default: "" },
    publishedBy: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: collectionName("page_layouts", "PageLayout") },
);
pageLayoutSchema.index({ key: 1, scope: 1 }, { unique: true });

const revisionCollection = collectionName("page_layout_revisions", "PageLayoutRevision");
const pageLayoutRevisionSchema = new Schema<PageLayoutRevisionDoc>(
  {
    key: { type: String, enum: PAGE_KEYS, required: true },
    scope: { type: String, required: true },
    version: { type: Number, required: true },
    blocks: { type: Schema.Types.Mixed, default: [] },
    publishedBy: { type: String, default: "" },
    publishedAt: { type: Date, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: revisionCollection },
);
pageLayoutRevisionSchema.index({ key: 1, scope: 1, version: 1 }, { unique: true });
appendOnlyPlugin(pageLayoutRevisionSchema, revisionCollection);

const uiTextSchema = new Schema<UiTextDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: collectionName("ui_texts", "UiText") },
);

const siteMediaSchema = new Schema<SiteMediaDoc>(
  {
    url: { type: String, required: true },
    objectKey: { type: String, required: true },
    alt: { type: String, required: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
    tags: { type: [String], default: [] },
    uploadedBy: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("site_media", "SiteMedia") },
);
siteMediaSchema.index({ objectKey: 1 }, { unique: true });

const listingPinSchema = new Schema<ListingPinDoc>(
  {
    scope: { type: String, required: true },
    listingId: { type: String, required: true },
    position: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdBy: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("listing_pins", "ListingPin") },
);
listingPinSchema.index({ scope: 1, position: 1 });

export const PageLayout = registerModel<PageLayoutDoc>(modelName("PageLayout"), pageLayoutSchema);
export const PageLayoutRevision = registerModel<PageLayoutRevisionDoc>(modelName("PageLayoutRevision"), pageLayoutRevisionSchema);
lockBulkWrites(PageLayoutRevision, revisionCollection);
export const UiText = registerModel<UiTextDoc>(modelName("UiText"), uiTextSchema);
export const SiteMedia = registerModel<SiteMediaDoc>(modelName("SiteMedia"), siteMediaSchema);
export const ListingPin = registerModel<ListingPinDoc>(modelName("ListingPin"), listingPinSchema);
