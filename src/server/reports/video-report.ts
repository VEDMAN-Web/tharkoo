import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** One report about the videos on an ad. Kept apart from the general Report model so the "video" reason needs no change there. */
export interface VideoReportDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  mediaId?: Types.ObjectId;
  reporterIpHash: string;
  details?: string;
  status: "open" | "dismissed" | "actioned";
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt?: Date;
}

const schema = new Schema<VideoReportDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true, index: true },
    mediaId: { type: Schema.Types.ObjectId },
    reporterIpHash: { type: String, required: true },
    details: { type: String, default: "" },
    status: { type: String, enum: ["open", "dismissed", "actioned"], default: "open", index: true },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("video_reports", "VideoReport") },
);

export const VideoReport = registerModel<VideoReportDoc>(modelName("VideoReport"), schema);
