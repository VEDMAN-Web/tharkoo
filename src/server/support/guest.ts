import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { siteOrigin } from "@/server/auth/http";
import { consumeRateLimit } from "@/server/auth/rate-limit";
import { ConflictError, ForbiddenError, RateLimitedError, ValidationError, parseInput } from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { hmacSha256, sha256 } from "@/server/shared/crypto";
import { BODY_MAX, BODY_MIN, SUBJECT_MAX, SUPPORT_TOPICS, type SupportTopic } from "@/server/support/constants";
import { isClosed, messageView, nextTicketNumber, summarize, type MessageRow, type TicketRow } from "@/server/support/records";
import { cleanSupportText } from "@/server/support/text";

/**
 * H7.1: guest support tickets. A visitor with no account gives a name and an email or a phone.
 * - Opening a ticket is rate limited per contact and per client address (Mongo counters, see consumeRateLimit).
 * - Replies go through a link that is only sent by email, and only when a mail provider is set (BREVO_API_KEY).
 *   Without email, staff reach the guest on the contact details shown in the desk.
 * - The link is /support/guest/<token>/. The token is random (256 bits). Only its hash is stored, on the ticket.
 *   It expires after 14 days. A newer link replaces it, so the older link stops working. Closing the ticket
 *   stops replies. The token is never put in a query string: it stays in the path and in the JSON body.
 */

const HOUR_MS = 60 * 60 * 1000;
const LINK_DAYS = 14;
const LINK_MS = LINK_DAYS * 24 * HOUR_MS;
export const GUEST_LIMITS = { ticketsPerContact: 3, ticketsPerAddress: 5, repliesPerTicket: 10, windowMs: HOUR_MS } as const;

const audit = new AuditRepository();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[A-Za-z0-9_-]{30,80}$/;

export const guestTicketSchema = z
  .object({
    name: z.string().trim().min(2, "Add your name").max(80),
    email: z.string().trim().max(120).optional().default(""),
    phone: z.string().trim().max(24).optional().default(""),
    topic: z.enum(SUPPORT_TOPICS, { message: "Choose a topic" }),
    body: z.string().trim().min(BODY_MIN, `Describe the problem in at least ${BODY_MIN} characters`).max(BODY_MAX),
  })
  .strict();

export const guestTokenBodySchema = z.object({ t: z.string().max(200).optional().default("") }).strict();

export const guestReplySchema = z
  .object({
    t: z.string().max(200).optional().default(""),
    body: z.string().trim().min(1, "Write a reply").max(BODY_MAX),
  })
  .strict();

/** Digits only, with an optional leading plus. Empty when the value is not a plausible phone number. */
export function normalisePhone(value: string): string {
  const cleaned = value.replace(/[\s()-]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned) ? cleaned : "";
}

/** Keyed hash for rate limits and the stored lookup of contacts and addresses. Never the raw value. */
export function guestKeyHash(value: string): string {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret ? hmacSha256(secret, value) : sha256(value);
}

/** A new random link token. 32 random bytes, URL safe. */
export function newGuestLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function guestLink(token: string): string {
  return `${siteOrigin()}/support/guest/${token}/`;
}

/** Stores a new link for the ticket (replacing any older one) and returns the token to send. */
export async function issueGuestLink(ticketId: string, now: Date): Promise<string> {
  await connectDb();
  const token = newGuestLinkToken();
  await SupportTicket.updateOne(
    { _id: ticketId },
    { $set: { guestLinkHash: sha256(token), guestLinkExpiresAt: new Date(now.getTime() + LINK_MS) } },
  );
  return token;
}

/** Emails a fresh link to the guest. Returns false when no mail provider is set. */
export async function sendGuestLink(input: { ticketId: string; number: number; email: string; now: Date }): Promise<boolean> {
  await connectDb();
  if (!process.env.BREVO_API_KEY?.trim()) return false;
  const token = await issueGuestLink(input.ticketId, input.now);
  await mailerFromEnv().send({
    to: input.email,
    subject: `Tharkoo support, ticket #${input.number}`,
    text: `Tharkoo support has an update on your ticket #${input.number}.\n\nRead it and reply here: ${guestLink(token)}\n\nThe link works for 14 days and only for this ticket.`,
  });
  return true;
}

/** Called by the desk when staff reply to a guest ticket that has an email address. */
export async function notifyGuestOfReply(input: { ticketId: string; number: number; email: string; now?: Date }) {
  await connectDb();
  await sendGuestLink({ ticketId: input.ticketId, number: input.number, email: input.email, now: input.now ?? new Date() });
}

async function assertUnderGuestLimits(input: { contactHash?: string; ipHash: string }) {
  if (input.contactHash) {
    const byContact = await consumeRateLimit(`guest-ticket:contact:${input.contactHash}`, GUEST_LIMITS.ticketsPerContact, GUEST_LIMITS.windowMs);
    if (!byContact.ok) throw new RateLimitedError("You have opened several tickets recently. Try again later.");
  }
  const byAddress = await consumeRateLimit(`guest-ticket:ip:${input.ipHash}`, GUEST_LIMITS.ticketsPerAddress, GUEST_LIMITS.windowMs);
  if (!byAddress.ok) throw new RateLimitedError("Too many requests from this connection. Try again later.");
}

/** Opens a guest ticket and its first message. The caller passes the hashed client address. */
export async function openGuestTicket(raw: unknown, input: { ipHash: string; requestId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const data = parseInput(guestTicketSchema, raw);
  const email = data.email.toLowerCase();
  const phone = normalisePhone(data.phone);
  if (email && !EMAIL.test(email)) throw new ValidationError("Check the email address", { email: ["Check the email address"] });
  if (!email && !phone) {
    throw new ValidationError("Add an email or a phone number", { contact: ["Add an email address or a phone number"] });
  }
  const primary = email || phone;
  await connectDb();
  const contactHash = guestKeyHash(`contact:${primary}`);
  await assertUnderGuestLimits({ contactHash, ipHash: input.ipHash });
  const id = new Types.ObjectId();
  const number = await nextTicketNumber();
  const body = cleanSupportText(data.body, BODY_MAX);
  await SupportTicket.create({
    _id: id,
    number,
    ownerKind: "guest",
    topic: data.topic as SupportTopic,
    subject: cleanSupportText(body, SUBJECT_MAX),
    status: "waiting_for_support",
    lastMessageAt: now,
    lastCustomerMessageAt: now,
    unreadForOwner: false,
    unreadForStaff: true,
    guestName: cleanSupportText(data.name, 80),
    guestEmail: email,
    guestPhone: phone,
    guestContactHash: contactHash,
    guestIpHash: input.ipHash,
  });
  await TicketMessage.create({ ticketId: id, authorType: "user", author: null, body, attachments: [], internal: false, opening: true, createdAt: now });
  await audit.append({
    actorType: "system",
    action: "support.guest_open",
    targetType: "support_ticket",
    targetId: id.toString(),
    requestId: input.requestId,
    after: { channel: email ? "email" : "phone" },
  });
  const emailed = email ? await sendGuestLink({ ticketId: id.toString(), number, email, now }) : false;
  return { id: id.toString(), number, status: "waiting_for_support" as const, replyVia: email ? ("email" as const) : ("phone" as const), emailed };
}

/** The ticket a link belongs to. Refuses a malformed, unknown, replaced, or expired token with one message. */
async function loadByToken(raw: unknown, now: Date): Promise<TicketRow> {
  const { t } = parseInput(guestTokenBodySchema, raw ?? {});
  const invalid = new ForbiddenError("This link is not valid or has expired.");
  if (!TOKEN.test(t)) throw invalid;
  await connectDb();
  const ticket = (await SupportTicket.findOne({ guestLinkHash: sha256(t), ownerKind: "guest" }).lean()) as TicketRow | null;
  if (!ticket || !ticket.guestLinkExpiresAt || ticket.guestLinkExpiresAt.getTime() < now.getTime()) throw invalid;
  return ticket;
}

/** The guest's own ticket, without internal notes. Only the ticket the link belongs to. */
export async function guestThread(raw: unknown, now = new Date()) {
  await connectDb();
  const ticket = await loadByToken(raw, now);
  const rows = (await TicketMessage.find({ ticketId: ticket._id, internal: false })
    .sort({ createdAt: 1, _id: 1 })
    .limit(500)
    .lean()) as MessageRow[];
  return { ticket: summarize(ticket, false), messages: rows.map(messageView) };
}

/** The guest answers through the link. The reply goes to the desk like any customer reply. */
export async function guestReply(raw: unknown, requestId: string, now = new Date()) {
  await connectDb();
  const input = parseInput(guestReplySchema, raw);
  const ticket = await loadByToken({ t: input.t }, now);
  if (isClosed(ticket)) throw new ConflictError("This ticket is closed. Open a new ticket if you still need help.");
  const limit = await consumeRateLimit(`guest-reply:${ticket._id.toString()}`, GUEST_LIMITS.repliesPerTicket, GUEST_LIMITS.windowMs);
  if (!limit.ok) throw new RateLimitedError("You are replying too often. Try again in a little while.");
  const body = cleanSupportText(input.body, BODY_MAX);
  const message = await TicketMessage.create({
    ticketId: ticket._id,
    authorType: "user",
    author: null,
    body,
    attachments: [],
    internal: false,
    opening: false,
    createdAt: now,
  });
  await SupportTicket.updateOne(
    { _id: ticket._id },
    { $set: { status: "waiting_for_support", lastMessageAt: now, lastCustomerMessageAt: now, unreadForStaff: true, unreadForOwner: false } },
  );
  await audit.append({
    actorType: "system",
    action: "support.guest_reply",
    targetType: "support_ticket",
    targetId: ticket._id.toString(),
    requestId,
    after: { messageId: message._id.toString() },
  });
  return messageView(message.toObject() as MessageRow);
}
