import mongoose, { type Types } from "mongoose";
import { NotFoundError } from "@/server/http";
import { SupportCounter, type SupportTicketDoc, type TicketMessageDoc } from "@/server/models/support";
import { STATUS_LABELS, TOPIC_LABELS, type SupportStatus, type SupportTopic } from "@/server/support/constants";

export type TicketRow = SupportTicketDoc & { _id: Types.ObjectId };
export type MessageRow = TicketMessageDoc & { _id: Types.ObjectId };

export interface TicketSummary {
  id: string;
  number: number;
  topic: SupportTopic;
  topicLabel: string;
  subject: string;
  status: SupportStatus;
  statusLabel: string;
  ownerKind: "user" | "vendor";
  assigned: boolean;
  unread: boolean;
  lastMessageAt: string;
  lastCustomerMessageAt: string;
  closedAt: string | null;
}

export interface MessageView {
  id: string;
  authorType: "user" | "staff";
  body: string;
  internal: boolean;
  createdAt: string;
  attachments: string[];
}

export function summarize(row: TicketRow, unread: boolean): TicketSummary {
  return {
    id: row._id.toString(),
    number: row.number,
    topic: row.topic,
    topicLabel: TOPIC_LABELS[row.topic],
    subject: row.subject,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    ownerKind: row.ownerKind,
    assigned: Boolean(row.assigneeId),
    unread,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastCustomerMessageAt: row.lastCustomerMessageAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

export function messageView(row: MessageRow): MessageView {
  return {
    id: row._id.toString(),
    authorType: row.authorType,
    body: row.body,
    internal: row.internal,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    attachments: row.attachments.map((id) => id.toString()),
  };
}

/** Ticket numbers come from one counter document, so they never repeat. */
export async function nextTicketNumber(): Promise<number> {
  const row = await SupportCounter.findByIdAndUpdate(
    "support_ticket",
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return row?.seq ?? 1;
}

export function assertObjectId(value: string, message: string) {
  if (!mongoose.isValidObjectId(value)) throw new NotFoundError(message);
}

export function isClosed(row: { status: SupportStatus }) {
  return row.status === "closed";
}
