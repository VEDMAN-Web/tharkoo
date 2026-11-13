import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** One chat between a buyer and the seller of an ad. Neither party's phone or email is stored here. */
export interface ConversationDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  listingTitle: string;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  lastMessageAt: Date;
  lastText: string;
  /** Set when one side blocks the other. Nobody can send while it is set. */
  blocked: boolean;
  blockedBy?: Types.ObjectId;
  blockedAt?: Date;
  /** Set when a side reports the chat. Staff may read a conversation only after this is set. */
  reportedAt?: Date;
  reportedBy?: Types.ObjectId;
  reportReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true },
    listingTitle: { type: String, default: "", maxlength: 200 },
    buyerId: { type: Schema.Types.ObjectId, required: true },
    sellerId: { type: Schema.Types.ObjectId, required: true },
    lastMessageAt: { type: Date, default: () => new Date() },
    lastText: { type: String, default: "", maxlength: 200 },
    blocked: { type: Boolean, default: false },
    blockedBy: { type: Schema.Types.ObjectId },
    blockedAt: { type: Date },
    reportedAt: { type: Date },
    reportedBy: { type: Schema.Types.ObjectId },
    reportReason: { type: String, maxlength: 300 },
  },
  { timestamps: true, collection: collectionName("conversations", "Conversation") },
);
conversationSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });
conversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
conversationSchema.index({ reportedAt: 1 }, { sparse: true });

export const Conversation = registerModel<ConversationDoc>(modelName("Conversation"), conversationSchema);
