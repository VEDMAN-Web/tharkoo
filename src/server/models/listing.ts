import { Schema, type Types } from "mongoose";
import { adAddress, generateAdCode } from "@/lib/ad-address";
import { connectDb } from "@/lib/db";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { Category, Location } from "@/server/models/catalog";
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
  subcategoryId?: Types.ObjectId;
  stateId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  districtId?: Types.ObjectId;
  localityId?: Types.ObjectId;
  title: string;
  slug?: string;
  /** H16.2: 5 lowercase base36 characters with a digit, set once. The last part of the public address. */
  code?: string;
  /** H16.2: the current public address, /<category>/<city>/<title-slug>-<code>/. */
  addressPath?: string;
  /** H16.2: earlier public addresses of this ad (newest last, at most 10). Each one answers with a permanent redirect. */
  previousPaths?: string[];
  description: string;
  attributes?: Record<string, unknown>;
  /** Asking price in whole rupees (INR). A real field, not an attribute. */
  price?: number;
  /** Name or nickname shown on the ad. Saved so editing an ad can load it again. */
  nickname?: string;
  contact?: ListingContactDoc;
  mediaIds?: Types.ObjectId[];
  coverMediaId?: Types.ObjectId;
  badges?: string[];
  qualityScore?: number;
  publishedAt?: Date;
  expiresAt?: Date;
  /** "Video verified" badge (H6.5): set for 90 days after a completed live tour. */
  videoVerifiedUntil?: Date | null;
  lastModerationAt?: Date;
  /** Set when staff say, on the launch checklist, that a title that looks like junk is fine. The checklist stops naming the ad. */
  notJunkAt?: Date | null;
  demoEndedBatch?: string;
  seoNoindex?: boolean;
  /** Admin only: the ad stays reachable by URL but is skipped in feeds. */
  feedHidden?: boolean;
  /** H21.5b: the owner turned video calls off for this ad. Default false (calls allowed). */
  videoCallsOff?: boolean;
  /** Admin only: the ad is chosen for the Home page row; homeOrder sorts the chosen ads (lowest first). */
  homeShow?: boolean;
  homeOrder?: number;
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
    subcategoryId: { type: Schema.Types.ObjectId, index: true },
    stateId: { type: Schema.Types.ObjectId },
    cityId: { type: Schema.Types.ObjectId },
    districtId: { type: Schema.Types.ObjectId },
    localityId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true },
    slug: { type: String },
    code: { type: String },
    addressPath: { type: String },
    previousPaths: { type: [String], default: undefined },
    description: { type: String, required: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, min: 0 },
    nickname: { type: String, maxlength: 40 },
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
    videoVerifiedUntil: { type: Date, default: null },
    lastModerationAt: { type: Date },
    notJunkAt: { type: Date, default: null },
    demoEndedBatch: { type: String },
    seoNoindex: { type: Boolean, default: true },
    feedHidden: { type: Boolean, default: false },
    videoCallsOff: { type: Boolean, default: false },
    homeShow: { type: Boolean, default: false },
    homeOrder: { type: Number, default: 0 },
    attestations: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: collectionName("listings", "Listing") },
);
listingSchema.index({ slug: 1 }, { unique: true, sparse: true });
listingSchema.index({ code: 1 }, { unique: true, sparse: true });
listingSchema.index({ status: 1, categoryId: 1, cityId: 1, publishedAt: -1 });
listingSchema.index({ status: 1, stateId: 1, publishedAt: -1 });
listingSchema.index({ status: 1, cityId: 1, publishedAt: -1 });
listingSchema.index({ status: 1, publishedAt: -1 });
listingSchema.index({ ownerId: 1, status: 1 });
listingSchema.index({ status: 1, lastModerationAt: 1, publishedAt: -1 });
listingSchema.index({ title: "text", description: "text" });

const MAX_PREVIOUS_PATHS = 10;
const CODE_TRIES = 20;

/** Codes handed out by this process that may not be saved yet (a big insertMany makes many at once). */
const handedOut = new Set<string>();
const HANDED_OUT_MAX = 100_000;

/** H16.2: a code no other ad uses. The unique index is the final guard against two processes racing. */
export async function freeAdCode(): Promise<string> {
  await connectDb();
  for (let i = 0; i < CODE_TRIES; i += 1) {
    const code = generateAdCode();
    // Claim the code before the database check, so two saves running at once cannot both take it.
    if (handedOut.has(code)) continue;
    if (handedOut.size >= HANDED_OUT_MAX) handedOut.clear();
    handedOut.add(code);
    if (!(await Listing.exists({ code }))) return code;
  }
  throw new Error("Could not make a free ad code");
}

/** H16.2: the public address of an ad, or "" while it lacks a code, a category or a city. */
export async function listingAddressPath(ad: { categoryId?: Types.ObjectId; cityId?: Types.ObjectId; title?: string; code?: string }): Promise<string> {
  if (!ad.code || !ad.categoryId || !ad.cityId || !ad.title) return "";
  await connectDb();
  const [category, city] = await Promise.all([
    Category.findById(ad.categoryId).select("slug").lean<{ slug?: string } | null>(),
    Location.findById(ad.cityId).select("slug").lean<{ slug?: string } | null>(),
  ]);
  if (!category?.slug || !city?.slug) return "";
  return adAddress({ categorySlug: category.slug, citySlug: city.slug, title: ad.title, code: ad.code });
}

/** H16.2: every ad gets its code on its first save. */
listingSchema.pre("validate", async function () {
  if (!this.code) this.code = await freeAdCode();
});

/**
 * H16.2: once an ad has a slug (it was posted), keep its public address up to date. When a change of title, category or
 * city moves the address, the old one is kept in previousPaths so it can redirect. Moves done with bulk writes skip this;
 * those addresses still redirect because the code, not the path, finds the ad.
 */
listingSchema.pre("save", async function () {
  if (!this.slug || !this.code) return;
  const needs = this.isNew || !this.addressPath || this.isModified("title") || this.isModified("categoryId") || this.isModified("cityId");
  if (!needs) return;
  const next = await listingAddressPath(this);
  if (!next || next === this.addressPath) return;
  if (this.addressPath) {
    const kept = (this.previousPaths ?? []).filter((path) => path !== this.addressPath && path !== next);
    this.previousPaths = [...kept, this.addressPath].slice(-MAX_PREVIOUS_PATHS);
  }
  this.addressPath = next;
});

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
listingVersionSchema.index({ listingId: 1, version: -1 });
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
