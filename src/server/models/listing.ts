import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export type ListingStatus =
  | "draft"
  | "pending"
  | "active"
  | "rejected"
  | "paused"
  | "expired"
  | "archived"
  | "removed"
  | "deleted";

export interface ListingContactDoc {
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  acceptForm?: boolean;
}

export interface ListingDoc {
  _id?: Types.ObjectId;
  ownerId: Types.ObjectId;
  status: ListingStatus;
  categoryId: Types.ObjectId;
  stateId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  districtId?: Types.ObjectId;
  localityId?: Types.ObjectId;
  title: string;
  slug?: string;
  description: string;
  attributes?: Record<string, unknown>;
  /** Asking price in whole rupees (INR). A real field, not an attribute. */
  price?: number;
  contact?: ListingContactDoc;
  mediaIds?: Types.ObjectId[];
  coverMediaId?: Types.ObjectId;
  badges?: string[];
  qualityScore?: number;
  publishedAt?: Date;
  expiresAt?: Date;
  lastModerationAt?: Date;
  seoNoindex?: boolean;
  /** Admin only: the ad stays reachable by URL but is skipped in feeds. */
  feedHidden?: boolean;
  attestations?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ListingVersionDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  version: number;
  snapshot: Record<string, unknown>;
  actorId: Types.ObjectId;
  createdAt?: Date;
}

export type MediaStatus =
  | "uploaded"
  | "scanning"
  | "processing"
  | "cleared"
  | "rejected_csam"
  | "rejected_policy"
  | "failed"
  | "deleted";

export interface MediaAssetDoc {
  _id?: Types.ObjectId;
  ownerId: Types.ObjectId;
  listingId?: Types.ObjectId;
  kind: "image" | "video" | "id_document";
  objectKey: string;
  thumbKey?: string;
  status: MediaStatus;
  hashes?: { sha256?: string };
  csamMatch?: { listId?: string; hitId?: string };
  contentType?: string;
  bytes?: number;
  clearedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FavouriteDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  createdAt?: Date;
}

export interface SavedSearchDoc {
  _id?: Types.ObjectId;
  userId?: Types.ObjectId;
  email: string;
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  lastSentAt?: Date;
  createdAt?: Date;
}

export interface ThreadDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  listingTitle: string;
  lastBody?: string;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageDoc {
  _id?: Types.ObjectId;
  threadId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  createdAt?: Date;
}

const listingSchema = new Schema<ListingDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "active",
        "rejected",
        "paused",
        "expired",
        "archived",
        "removed",
        "deleted",
      ],
      default: "draft",
    },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    stateId: { type: Schema.Types.ObjectId },
    cityId: { type: Schema.Types.ObjectId },
    districtId: { type: Schema.Types.ObjectId },
    localityId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true },
    slug: { type: String },
    description: { type: String, required: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, min: 0 },
    contact: {
      type: new Schema<ListingContactDoc>(
        { phone: String, whatsapp: String, telegram: String, acceptForm: Boolean },
        { _id: false },
      ),
      select: false,
    },
    mediaIds: { type: [Schema.Types.ObjectId], default: [] },
    coverMediaId: { type: Schema.Types.ObjectId },
    badges: { type: [String], default: [] },
    qualityScore: { type: Number, default: 0 },
    publishedAt: { type: Date },
    expiresAt: { type: Date },
    lastModerationAt: { type: Date },
    seoNoindex: { type: Boolean, default: true },
    feedHidden: { type: Boolean, default: false },
    attestations: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: collectionName("listings", "Listing") },
);
listingSchema.index({ slug: 1 }, { unique: true, sparse: true });
listingSchema.index({ status: 1, categoryId: 1, cityId: 1, publishedAt: -1 });
listingSchema.index({ ownerId: 1, status: 1 });
listingSchema.index({ title: "text", description: "text" });

const listingVersionSchema = new Schema<ListingVersionDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("listing_versions", "ListingVersion"),
  },
);
appendOnlyPlugin(listingVersionSchema, collectionName("listing_versions", "ListingVersion"));

const mediaAssetSchema = new Schema<MediaAssetDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, index: true },
    kind: { type: String, enum: ["image", "video", "id_document"], required: true },
    objectKey: { type: String, required: true },
    thumbKey: { type: String },
    status: {
      type: String,
      enum: [
        "uploaded",
        "scanning",
        "processing",
        "cleared",
        "rejected_csam",
        "rejected_policy",
        "failed",
        "deleted",
      ],
      default: "uploaded",
    },
    hashes: { sha256: { type: String, index: true } },
    csamMatch: { listId: String, hitId: String },
    contentType: { type: String },
    bytes: { type: Number },
    clearedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: collectionName("media_assets", "MediaAsset"),
  },
);

const favouriteSchema = new Schema<FavouriteDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("favourites", "Favourite"),
  },
);
favouriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const savedSearchSchema = new Schema<SavedSearchDoc>(
  {
    userId: { type: Schema.Types.ObjectId },
    email: { type: String, required: true },
    q: { type: String, default: "" },
    categorySlug: { type: String, default: "" },
    citySlug: { type: String, default: "" },
    lastSentAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("saved_searches", "SavedSearch"),
  },
);
savedSearchSchema.index({ email: 1, q: 1, categorySlug: 1, citySlug: 1 }, { unique: true });

const threadSchema = new Schema<ThreadDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true },
    buyerId: { type: Schema.Types.ObjectId, required: true },
    sellerId: { type: Schema.Types.ObjectId, required: true },
    listingTitle: { type: String, required: true },
    lastBody: { type: String, default: "" },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: collectionName("threads", "Thread") },
);
threadSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
threadSchema.index({ sellerId: 1, lastMessageAt: -1 });
threadSchema.index({ buyerId: 1, lastMessageAt: -1 });

const messageSchema = new Schema<MessageDoc>(
  {
    threadId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("messages", "Message"),
  },
);

export const Listing = registerModel<ListingDoc>(modelName("Listing"), listingSchema);
export const ListingVersion = registerModel<ListingVersionDoc>(
  modelName("ListingVersion"),
  listingVersionSchema,
);
export const MediaAsset = registerModel<MediaAssetDoc>(modelName("MediaAsset"), mediaAssetSchema);
export const Favourite = registerModel<FavouriteDoc>(modelName("Favourite"), favouriteSchema);
export const SavedSearch = registerModel<SavedSearchDoc>(modelName("SavedSearch"), savedSearchSchema);
export const Thread = registerModel<ThreadDoc>(modelName("Thread"), threadSchema);
export const Message = registerModel<MessageDoc>(modelName("Message"), messageSchema);

lockBulkWrites(ListingVersion, collectionName("listing_versions", "ListingVersion"));
