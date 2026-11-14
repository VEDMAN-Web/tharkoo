import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";
import { SUPPORT_STATUSES, SUPPORT_TOPICS, type SupportStatus, type SupportTopic } from "@/server/support/constants";

/** One support ticket. The owner is the account that opened it. */
export interface SupportTicketDoc {
  _id?: Types.ObjectId;
  number: number;
  ownerId: Types.ObjectId;
  /** "vendor" when the owner has at least one ad, otherwise "user". Set once, when the ticket is opened. */
  ownerKind: "user" | "vendor";
  topic: SupportTopic;
  subject: string;
  status: SupportStatus;
  assigneeId: Types.ObjectId | null;
  lastMessageAt: Date;
  /** The newest message written by the owner. Drives "oldest waiting first" and the age shown to staff. */
  lastCustomerMessageAt: Date;
  /** True while the owner has a staff reply they have not opened yet. */
  unreadForOwner: boolean;
  /** True while staff have a customer message they have not opened yet. */
  unreadForStaff: boolean;
  closedBy: Types.ObjectId | null;
  closedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ticketSchema = new Schema<SupportTicketDoc>(
  {
    number: { type: Number, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    ownerKind: { type: String, enum: ["user", "vendor"], required: true },
    topic: { type: String, enum: SUPPORT_TOPICS, required: true },
    subject: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: SUPPORT_STATUSES, required: true, default: "waiting_for_support" },
    assigneeId: { type: Schema.Types.ObjectId, default: null },
    lastMessageAt: { type: Date, required: true },
    lastCustomerMessageAt: { type: Date, required: true },
    unreadForOwner: { type: Boolean, default: false },
    unreadForStaff: { type: Boolean, default: true },
    closedBy: { type: Schema.Types.ObjectId, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: collectionName("support_tickets", "SupportTicket") },
);
ticketSchema.index({ number: 1 }, { unique: true });
ticketSchema.index({ ownerId: 1, lastMessageAt: -1 });
ticketSchema.index({ status: 1, lastCustomerMessageAt: 1 });
ticketSchema.index({ assigneeId: 1, status: 1 });
ticketSchema.index({ unreadForStaff: 1, status: 1 });

/** One message in a ticket. Internal notes are staff-only and are never returned to the owner. */
export interface TicketMessageDoc {
  _id?: Types.ObjectId;
  ticketId: Types.ObjectId;
  author: Types.ObjectId;
  authorType: "user" | "staff";
  body: string;
  attachments: Types.ObjectId[];
  internal: boolean;
  /** True for the first message of a new ticket. Opening messages do not count against the reply limit. */
  opening: boolean;
  createdAt?: Date;
}

const messageSchema = new Schema<TicketMessageDoc>(
  {
    ticketId: { type: Schema.Types.ObjectId, required: true },
    author: { type: Schema.Types.ObjectId, required: true },
    authorType: { type: String, enum: ["user", "staff"], required: true },
    body: { type: String, default: "", maxlength: 4000 },
    attachments: { type: [Schema.Types.ObjectId], default: [] },
    internal: { type: Boolean, default: false },
    opening: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("ticket_messages", "TicketMessage") },
);
messageSchema.index({ ticketId: 1, createdAt: 1 });
messageSchema.index({ author: 1, authorType: 1, opening: 1, createdAt: -1 });

/** Counter for human-friendly ticket numbers. One document, incremented per ticket. */
interface SupportCounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<SupportCounterDoc>(
  { _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } },
  { collection: collectionName("support_counters", "SupportCounter") },
);

export const SupportTicket = registerModel<SupportTicketDoc>(modelName("SupportTicket"), ticketSchema);
export const TicketMessage = registerModel<TicketMessageDoc>(modelName("TicketMessage"), messageSchema);
export const SupportCounter = registerModel<SupportCounterDoc>(modelName("SupportCounter"), counterSchema);
