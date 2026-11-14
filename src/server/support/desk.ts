import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { User } from "@/server/models";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { DESK_ROLES, SUPPORT_PAGE_SIZE, type SupportStatus } from "@/server/support/constants";
import { assertDeskActor, canWorkDesk, type DeskActor } from "@/server/support/access";
import { storeScreenshots, type Screenshot } from "@/server/support/attachments";
import { notifyGuestOfReply } from "@/server/support/guest";
import { notifyOwnerOfReply } from "@/server/support/notify";
import { assertObjectId, isClosed, messageView, summarize, type MessageRow, type TicketRow } from "@/server/support/records";
import type { QueueQuery, ReplyInput } from "@/server/support/schemas";

const audit = new AuditRepository();

export interface QueueItem extends ReturnType<typeof summarize> {
  ownerName: string;
  assigneeName: string;
  /** ISO time of the newest customer message. The screen shows how long ago it was. */
  waitingSince: string;
}

async function namesById(ids: Types.ObjectId[]) {
  const unique = [...new Set(ids.map((id) => id.toString()))];
  if (unique.length === 0) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } })
    .select("displayName")
    .lean<{ _id: Types.ObjectId; displayName?: string }[]>();
  return new Map(users.map((user) => [user._id.toString(), user.displayName || "Member"]));
}

function queueMatch(query: QueueQuery, actor: DeskActor) {
  const match: Record<string, unknown> = {};
  match.status = query.status === "active" ? { $ne: "closed" } : query.status;
  if (query.topic) match.topic = query.topic;
  if (query.owner) match.ownerKind = query.owner;
  if (query.assigned === "me") match.assigneeId = new Types.ObjectId(actor.id);
  return match;
}

/** Queue: customers waiting for support come first, then the oldest customer message. */
/** Name shown for a ticket's owner. Guests have no account, so the name they gave is shown. */
function ownerLabel(row: TicketRow, names: Map<string, string>): string {
  if (row.ownerKind === "guest") return row.guestName || "Guest";
  return (row.ownerId && names.get(row.ownerId.toString())) || "Member";
}

export async function deskQueue(actor: DeskActor | null, query: QueueQuery) {
  assertDeskActor(actor);
  await connectDb();
  const match = queueMatch(query, actor);
  const skip = (query.page - 1) * SUPPORT_PAGE_SIZE;
  const [total, rows] = await Promise.all([
    SupportTicket.countDocuments(match),
    SupportTicket.aggregate<TicketRow>([
      { $match: match },
      { $addFields: { waitingRank: { $cond: [{ $eq: ["$status", "waiting_for_support"] }, 0, 1] } } },
      { $sort: { waitingRank: 1, lastCustomerMessageAt: 1, _id: 1 } },
      { $skip: skip },
      { $limit: SUPPORT_PAGE_SIZE },
    ]),
  ]);
  const names = await namesById([
    ...rows.flatMap((row) => (row.ownerId ? [row.ownerId] : [])),
    ...rows.flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
  ]);
  const items: QueueItem[] = rows.map((row) => ({
    ...summarize(row, row.unreadForStaff),
    ownerName: ownerLabel(row, names),
    assigneeName: row.assigneeId ? (names.get(row.assigneeId.toString()) ?? "Staff") : "",
    waitingSince: row.lastCustomerMessageAt.toISOString(),
  }));
  return { items, total, page: query.page, pageSize: SUPPORT_PAGE_SIZE, now: Date.now() };
}

async function loadTicket(ticketId: string): Promise<TicketRow> {
  assertObjectId(ticketId, "Ticket not found");
  await connectDb();
  const ticket = (await SupportTicket.findById(ticketId).lean()) as TicketRow | null;
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

/** People who can be assigned a ticket: active accounts with a desk role. */
export async function deskStaff() {
  await connectDb();
  const rows = await User.find({ roles: { $in: [...DESK_ROLES] }, status: "active" })
    .select("displayName")
    .sort({ displayName: 1 })
    .limit(100)
    .lean<{ _id: Types.ObjectId; displayName?: string }[]>();
  return rows.map((row) => ({ id: row._id.toString(), name: row.displayName || "Staff" }));
}

/** Full thread for staff, internal notes included. Opening it clears the staff unread mark and is audited. */
export async function deskThread(actor: DeskActor | null, ticketId: string, requestId: string) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  const rows = (await TicketMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1, _id: 1 }).limit(500).lean()) as MessageRow[];
  // Guest tickets have no account: staff see the name and the contact the guest gave.
  const owner = ticket.ownerKind === "guest"
    ? { displayName: ticket.guestName || "Guest", email: ticket.guestEmail || "", phone: ticket.guestPhone || "" }
    : await User.findById(ticket.ownerId).select("displayName email").lean<{ displayName?: string; email?: string; phone?: string } | null>();
  if (ticket.unreadForStaff) await SupportTicket.updateOne({ _id: ticket._id }, { $set: { unreadForStaff: false } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "support.view",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    requestId,
  });
  return {
    ticket: summarize(ticket, false),
    owner: { name: owner?.displayName || "Member", email: owner?.email || "", phone: owner?.phone || "" },
    messages: rows.map(messageView),
    staff: await deskStaff(),
  };
}

/** Counts for the staff dashboard notice. Zero when the viewer cannot use the desk. */
export async function deskSummary(actor: DeskActor | null) {
  if (!actor || !canWorkDesk(actor.roles)) return { unread: 0, waiting: 0 };
  await connectDb();
  const [unread, waiting] = await Promise.all([
    SupportTicket.countDocuments({ unreadForStaff: true, status: { $ne: "closed" } }),
    SupportTicket.countDocuments({ status: "waiting_for_support" }),
  ]);
  return { unread, waiting };
}

/** Staff reply to the customer, or an internal note that the customer never sees. */
export async function deskReply(
  actor: DeskActor | null,
  ticketId: string,
  input: ReplyInput,
  screenshots: Screenshot[],
  requestId: string,
  now = new Date(),
) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  if (!input.internal && isClosed(ticket)) throw new ConflictError("Reopen this ticket before replying to the customer.");
  if (!input.body && screenshots.length === 0) {
    throw new ValidationError("Write a reply or attach a screenshot", { body: ["Write a reply or attach a screenshot"] });
  }
  const attachments = await storeScreenshots(ticket._id, actor.id, screenshots);
  const message = await TicketMessage.create({
    ticketId: ticket._id,
    author: new Types.ObjectId(actor.id),
    authorType: "staff",
    body: input.body,
    attachments,
    internal: input.internal,
    opening: false,
    createdAt: now,
  });
  if (!input.internal) {
    await SupportTicket.updateOne(
      { _id: ticket._id },
      { $set: { status: "waiting_for_user", lastMessageAt: now, unreadForOwner: true, unreadForStaff: false } },
    );
    if (ticket.ownerKind === "guest") {
      // H7.1: a guest is told by email only, and only when an address was given. Otherwise staff reach them on the contact in the desk.
      if (ticket.guestEmail) await notifyGuestOfReply({ ticketId: ticket._id.toString(), number: ticket.number, email: ticket.guestEmail, now });
    } else if (ticket.ownerId) {
      await notifyOwnerOfReply({ ownerId: ticket.ownerId.toString(), ticketId: ticket._id.toString(), number: ticket.number });
    }
  }
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: input.internal ? "support.note" : "support.reply",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    after: { messageId: message._id.toString(), internal: input.internal, attachments: attachments.length },
    requestId,
  });
  return messageView(message.toObject() as MessageRow);
}

/** Changes status. Closing and reopening have their own calls so each one is audited on its own. */
export async function deskSetStatus(
  actor: DeskActor | null,
  ticketId: string,
  status: Exclude<SupportStatus, "closed">,
  requestId: string,
) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  if (isClosed(ticket)) throw new ConflictError("Reopen this ticket before changing its status.");
  if (ticket.status === status) return { status };
  await SupportTicket.updateOne({ _id: ticket._id }, { $set: { status } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "support.status",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    before: { status: ticket.status },
    after: { status },
    requestId,
  });
  return { status };
}

async function assigneeFor(actor: DeskActor, assigneeId: string): Promise<Types.ObjectId | null> {
  if (assigneeId === "none") return null;
  if (assigneeId === "me") return new Types.ObjectId(actor.id);
  const target = await User.findById(assigneeId).select("roles status").lean<{ roles?: string[]; status?: string } | null>();
  const canDesk = Boolean(target?.roles?.some((role) => (DESK_ROLES as readonly string[]).includes(role)));
  if (!target || target.status !== "active" || !canDesk) throw new ValidationError("Pick a support team member");
  return new Types.ObjectId(assigneeId);
}

export async function deskAssign(actor: DeskActor | null, ticketId: string, assigneeId: string, requestId: string) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  const next = await assigneeFor(actor, assigneeId);
  await SupportTicket.updateOne({ _id: ticket._id }, { $set: { assigneeId: next } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "support.assign",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    before: { assigneeId: ticket.assigneeId ? ticket.assigneeId.toString() : null },
    after: { assigneeId: next ? next.toString() : null },
    requestId,
  });
  return { assigned: Boolean(next) };
}

export async function deskClose(actor: DeskActor | null, ticketId: string, requestId: string, now = new Date()) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  if (isClosed(ticket)) throw new ConflictError("This ticket is already closed.");
  await SupportTicket.updateOne(
    { _id: ticket._id },
    { $set: { status: "closed", closedBy: new Types.ObjectId(actor.id), closedAt: now } },
  );
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "support.close",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    before: { status: ticket.status },
    after: { status: "closed" },
    requestId,
  });
  return { status: "closed" as const };
}

export async function deskReopen(actor: DeskActor | null, ticketId: string, requestId: string) {
  assertDeskActor(actor);
  const ticket = await loadTicket(ticketId);
  if (!isClosed(ticket)) throw new ConflictError("Only a closed ticket can be reopened.");
  await SupportTicket.updateOne({ _id: ticket._id }, { $set: { status: "open", closedBy: null, closedAt: null } });
  await audit.append({
    actorId: actor.id,
    actorType: "admin",
    action: "support.reopen",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    before: { status: "closed" },
    after: { status: "open" },
    requestId,
  });
  return { status: "open" as const };
}
