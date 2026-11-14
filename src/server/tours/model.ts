import { Schema, type Types } from "mongoose";
import { registerModel } from "@/server/models/register";

export const TOUR_STATUSES = [
  "requested",
  "accepted",
  "ending",
  "completed",
  "declined",
  "expired",
  "failed",
  "disputed",
  "reversing",
  "reversed",
] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];

export interface VideoTourDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  /** The advertiser who owns the ad and accepts the tour. */
  ownerId: Types.ObjectId;
  /** The buyer who requested the tour and paid one coin (or the category price). */
  userId: Types.ObjectId;
  coins: number;
  status: TourStatus;
  requestedAt: Date;
  acceptedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  roomId?: string;
  eventId?: string;
  failureReason?: string;
  disputeReason?: string;
  disputedAt?: Date | null;
  reversedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const tourSchema = new Schema<VideoTourDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    coins: { type: Number, required: true, min: 1 },
    status: { type: String, enum: TOUR_STATUSES, default: "requested", required: true },
    requestedAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    roomId: { type: String, default: "" },
    eventId: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    disputeReason: { type: String, default: "", maxlength: 500 },
    disputedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "video_tours" },
);

/** One open tour per buyer and ad: a second request while one is open is refused by the database. */
tourSchema.index(
  { listingId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["requested", "accepted", "ending"] } } },
);
tourSchema.index({ status: 1, requestedAt: 1 });
tourSchema.index({ ownerId: 1, status: 1 });

export const VideoTour = registerModel<VideoTourDoc>("VideoTour", tourSchema);
