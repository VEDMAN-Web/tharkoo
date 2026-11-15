import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "@/server/http";
import { Listing } from "@/server/models";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { RATE_WINDOW_MS, TICKET_OPEN_LIMIT, TICKET_REPLY_LIMIT } from "@/server/support/constants";
import { storeScreenshots, type Screenshot } from "@/server/support/attachments";
import { assertObjectId, isClosed, messageView, nextTicketNumber, summarize, type MessageRow, type TicketRow } from "@/server/support/records";
import type { ReplyInput, TicketCreateInput } from "@/server/support/schemas";

const audit = new AuditRepository();

async function ownTicket(userId: string, ticketId: string): Promise<TicketRow> {
  assertObjectId(ticketId, "Ticket not found");
  await connectDb();
  const ticket = (await SupportTicket.findOne({ _id: ticketId, ownerId: userId }).lean()) as TicketRow | null;
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

async function assertUnderOpenLimit(userId: string, now: Date) {
  const since = new Date(now.getTime() - RATE_WINDOW_MS);
  const opened = await SupportTicket.countDocuments({ ownerId: userId, createdAt: { $gt: since } });
  if (opened >= TICKET_OPEN_LIMIT) {
    throw new RateLimitedError(`You can open ${TICKET_OPEN_LIMIT} tickets an hour. Try again later.`);
  }
}

async function assertUnderReplyLimit(userId: string, now: Date) {
  const since = new Date(now.getTime() - RATE_WINDOW_MS);
  const sent = await TicketMessage.countDocuments({ author: userId, authorType: "user", opening: false, createdAt: { $gt: since } });
  if (sent >= TICKET_REPLY_LIMIT) throw new RateLimitedError("You are replying too often. Try again in a little while.");
}

async function ownerKindOf(userId: string): Promise<"user" | "vendor"> {
  const hasAds = await Listing.exists({ ownerId: userId });
  return hasAds ? "vendor" : "user";
}

/** Opens a ticket and its first message. Screenshots are checked before anything is written. */
export async function openTicket(
  userId: string,
  input: TicketCreateInput,
  screenshots: Screenshot[],
  requestId: string,
  now = new Date(),
) {
  await connectDb();
  await assertUnderOpenLimit(userId, now);
  const ticketId = new Types.ObjectId();
  const number = await nextTicketNumber();
  const ownerKind = await ownerKindOf(userId);
  const attachments = await storeScreenshots(ticketId, userId, screenshots);
  await SupportTicket.create({
    _id: ticketId,
    number,
    ownerId: new Types.ObjectId(userId),
    ownerKind,
    topic: input.topic,
    subject: input.subject,
    status: "waiting_for_support",
    assigneeId: null,
    lastMessageAt: now,
    lastCustomerMessageAt: now,
    unreadForOwner: false,
    unreadForStaff: true,
    closedBy: null,
    closedAt: null,
  });
  await TicketMessage.create({
    ticketId,
    author: new Types.ObjectId(userId),
    authorType: "user",
    body: input.body,
    attachments,
    internal: false,
    opening: true,
    createdAt: now,
  });
  await audit.append({
    actorId: userId,
    actorType: "user",
    action: "support.open",
    targetType: "support_ticket",
    targetId: ticketId.toString(),
    after: { number, topic: input.topic, ownerKind },
    requestId,
  });
  return { id: ticketId.toString(), number, status: "waiting_for_support" as const };
}

export async function listMyTickets(userId: string) {
  await connectDb();
  const rows = (await SupportTicket.find({ ownerId: userId }).sort({ lastMessageAt: -1 }).limit(100).lean()) as TicketRow[];
  return rows.map((row) => summarize(row, row.unreadForOwner));
}

/** The owner's thread without internal notes. Opening it clears the unread mark. */
export async function myThread(userId: string, ticketId: string) {
  await connectDb();
  const ticket = await ownTicket(userId, ticketId);
  const rows = (await TicketMessage.find({ ticketId: ticket._id, internal: false })
    .sort({ createdAt: 1, _id: 1 })
    .limit(500)
    .lean()) as MessageRow[];
  if (ticket.unreadForOwner) await SupportTicket.updateOne({ _id: ticket._id }, { $set: { unreadForOwner: false } });
  return { ticket: summarize(ticket, false), messages: rows.map(messageView) };
}

export async function replyAsOwner(
  userId: string,
  ticketId: string,
  input: ReplyInput,
  screenshots: Screenshot[],
  requestId: string,
  now = new Date(),
) {
  await connectDb();
  const ticket = await ownTicket(userId, ticketId);
  if (isClosed(ticket)) throw new ConflictError("This ticket is closed. Open a new ticket if you still need help.");
  if (!input.body && screenshots.length === 0) {
    throw new ValidationError("Write a reply or attach a screenshot", { body: ["Write a reply or attach a screenshot"] });
  }
  await assertUnderReplyLimit(userId, now);
  const attachments = await storeScreenshots(ticket._id, userId, screenshots);
  const message = await TicketMessage.create({
    ticketId: ticket._id,
    author: new Types.ObjectId(userId),
    authorType: "user",
    body: input.body,
    attachments,
    internal: false,
    opening: false,
    createdAt: now,
  });
  await SupportTicket.updateOne(
    { _id: ticket._id },
    { $set: { status: "waiting_for_support", lastMessageAt: now, lastCustomerMessageAt: now, unreadForStaff: true, unreadForOwner: false } },
  );
  await audit.append({
    actorId: userId,
    actorType: "user",
    action: "support.reply",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    after: { messageId: message._id.toString(), attachments: attachments.length },
    requestId,
  });
  return messageView(message.toObject() as MessageRow);
}

/** Owners can never close a ticket. Staff close it from the desk. */
export function ownerCannotClose(): never {
  throw new ForbiddenError("Only Tharkoo support can close a ticket. Reply if the problem is still there.");
}

export async function unreadForOwner(userId: string) {
  await connectDb();
  return SupportTicket.countDocuments({ ownerId: userId, unreadForOwner: true });
}
