import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** One chat message. Named ChatMessage because the older, unused `Message` model already holds that name. */
export interface ChatMessageDoc {
  _id?: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  imageUrl?: string;
  readAt?: Date;
  /** Set when staff delete the message; the text and image are cleared. */
  deletedAt?: Date;
  createdAt?: Date;
}

const chatMessageSchema = new Schema<ChatMessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, default: "", maxlength: 1000 },
    imageUrl: { type: String, maxlength: 500 },
    readAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("chat_messages", "ChatMessage") },
);
chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });

export const ChatMessage = registerModel<ChatMessageDoc>(modelName("ChatMessage"), chatMessageSchema);
