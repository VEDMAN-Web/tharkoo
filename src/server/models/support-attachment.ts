import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/**
 * A screenshot on a ticket message. The bytes stay in the database and are served only through the
 * attachment route, which checks the viewer, so no public URL ever points at a support screenshot.
 */
export interface SupportAttachmentDoc {
  _id?: Types.ObjectId;
  ticketId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  data: Buffer;
  createdAt?: Date;
}

const attachmentSchema = new Schema<SupportAttachmentDoc>(
  {
    ticketId: { type: Schema.Types.ObjectId, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
    byteSize: { type: Number, required: true, max: 5 * 1024 * 1024 },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("support_attachments", "SupportAttachment") },
);

export const SupportAttachment = registerModel<SupportAttachmentDoc>(modelName("SupportAttachment"), attachmentSchema);
