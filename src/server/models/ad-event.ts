import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/**
 * H6.17: one row per (ad, visitor, type). The unique index is what makes "once per visitor, per ad, ever" hold
 * under concurrent requests: only the insert that wins increments the counter.
 * `visitorKey` is an HMAC of the signed-in user id or of the first-party visitor cookie. No IP, no raw cookie.
 */
export type AdEventType = "view" | "click";

export interface AdEventDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  visitorKey: string;
  type: AdEventType;
  createdAt?: Date;
}

/**
 * Real counts for one ad, kept apart from the Listing document so the generic admin editor for Listing cannot write them.
 * `realViews` / `realClicks` only grow, from AdEvent inserts.
 * The shown number = set value + (real - real-at-set). Admins set `viewsSet` / `clicksSet`; the server records the real count at that moment.
 */
export interface AdCounterDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  realViews: number;
  realClicks: number;
  viewsSet: number;
  viewsRealAtSet: number;
  clicksSet: number;
  clicksRealAtSet: number;
  countsSetAt?: Date | null;
  countsSetBy?: string | null;
  updatedAt?: Date;
}

const adEventSchema = new Schema<AdEventDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true },
    visitorKey: { type: String, required: true, maxlength: 128 },
    type: { type: String, enum: ["view", "click"], required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("ad_events", "AdEvent"),
  },
);
adEventSchema.index({ listingId: 1, visitorKey: 1, type: 1 }, { unique: true });

const adCounterSchema = new Schema<AdCounterDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true },
    realViews: { type: Number, default: 0, min: 0 },
    realClicks: { type: Number, default: 0, min: 0 },
    viewsSet: { type: Number, default: 0, min: 0 },
    viewsRealAtSet: { type: Number, default: 0, min: 0 },
    clicksSet: { type: Number, default: 0, min: 0 },
    clicksRealAtSet: { type: Number, default: 0, min: 0 },
    countsSetAt: { type: Date, default: null },
    countsSetBy: { type: String, default: null },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: collectionName("ad_counters", "AdCounter"),
  },
);
adCounterSchema.index({ listingId: 1 }, { unique: true });

export const AdEvent = registerModel<AdEventDoc>(modelName("AdEvent"), adEventSchema);
export const AdCounter = registerModel<AdCounterDoc>(modelName("AdCounter"), adCounterSchema);
