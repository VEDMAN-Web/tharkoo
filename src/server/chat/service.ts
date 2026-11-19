import { randomUUID } from "node:crypto";
import { CHAT_AD_NOT_LIVE } from "@/lib/chat-text";
import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { touchOwnPresence } from "@/server/availability/service";
import { AuditRepository } from "@/server/audit";
import { isStaffRole } from "@/server/auth/service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
  isDuplicateKey,
} from "@/server/http";
import { storeChatImage } from "@/server/chat/image";
import { Listing, MediaAsset, User } from "@/server/models";
import { previewUrlOf } from "@/server/media/mine";
import { Conversation, type ConversationDoc } from "@/server/models/conversation";
import { ChatMessage, type ChatMessageDoc } from "@/server/models/message-chat";

export const CHAT_TEXT_MAX = 1000;
export const CHAT_RATE_LIMIT = 30;
export const CHAT_RATE_WINDOW_MS = 10 * 60 * 1000;
export const CHAT_PAGE = 100;

const audit = new AuditRepository();

type Conv = ConversationDoc & { _id: Types.ObjectId };

export interface ChatMessageView {
  id: string;
  mine: boolean;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  read: boolean;
  deleted: boolean;
}

export interface ConversationView {
  id: string;
  listingId: string;
  listingTitle: string;
  role: "buyer" | "seller";
  lastText: string;
  lastMessageAt: string;
  unread: number;
  blocked: boolean;
  peerName: string;
  cover: string | null;
  adSlug: string | null;
  adLive: boolean;
}

export function cleanChatText(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return text.replace(/<[^>]*>/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, CHAT_TEXT_MAX);
}

function assertId(value: string, message: string) {
  if (!mongoose.isValidObjectId(value)) throw new NotFoundError(message);
}

async function participantConversation(userId: string, conversationId: string): Promise<Conv> {
  assertId(conversationId, "Conversation not found");
  await connectDb();
  const found = (await Conversation.findById(conversationId).lean()) as Conv | null;
  const isMember = found && (found.buyerId.toString() === userId || found.sellerId.toString() === userId);
  if (!found || !isMember) throw new NotFoundError("Conversation not found");
  return found;
}

function viewOf(message: ChatMessageDoc & { _id: Types.ObjectId }, userId: string): ChatMessageView {
  const deleted = Boolean(message.deletedAt);
  return {
    id: message._id.toString(),
    mine: message.senderId.toString() === userId,
    text: deleted ? "" : message.text,
    imageUrl: deleted ? null : (message.imageUrl ?? null),
    createdAt: (message.createdAt ?? new Date()).toISOString(),
    read: Boolean(message.readAt),
    deleted,
  };
}

/** Opens the chat for an ad, or returns the one that already exists. The buyer is the signed-in user. */
export async function startConversation(userId: string, listingId: string) {
  assertId(listingId, "Ad not found");
  await connectDb();
  const listing = await Listing.findById(listingId).select("ownerId title status").lean();
  if (!listing || listing.status !== "active") throw new NotFoundError("This ad is not open for chat");
  const sellerId = listing.ownerId.toString();
  if (sellerId === userId) throw new ValidationError("This is your own ad");
  const filter = { listingId: listing._id, buyerId: userId };
  const existing = await Conversation.findOne(filter).select("_id").lean();
  if (existing) return { conversationId: existing._id.toString() };
  try {
    const created = await Conversation.create({ ...filter, sellerId, listingTitle: String(listing.title || "").slice(0, 200) });
    return { conversationId: created._id.toString() };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await Conversation.findOne(filter).select("_id").lean();
    if (!raced) throw error;
    return { conversationId: raced._id.toString() };
  }
}

export { CHAT_AD_NOT_LIVE };

/** An ad takes chat only while it is active and its end date has not passed. */
async function adIsLive(listingId: Types.ObjectId | string, now = new Date()) {
  const ad = await Listing.findById(listingId).select("status expiresAt").lean<{ status?: string; expiresAt?: Date } | null>();
  if (!ad || ad.status !== "active") return false;
  return !ad.expiresAt || ad.expiresAt.getTime() > now.getTime();
}

/** 30 messages per 10 minutes per user. Counted from stored messages, so it holds across server instances. */
async function assertUnderRateLimit(userId: string, now: Date) {
  const since = new Date(now.getTime() - CHAT_RATE_WINDOW_MS);
  const sent = await ChatMessage.countDocuments({ senderId: userId, createdAt: { $gt: since } });
  if (sent >= CHAT_RATE_LIMIT) throw new RateLimitedError("You are sending messages too fast. Try again in a few minutes.");
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { text?: unknown; image?: { type: string; data: Buffer } | null },
  now = new Date(),
) {
  await connectDb();
  const conv = await participantConversation(userId, conversationId);
  if (conv.blocked) throw new ForbiddenError("You can no longer message in this conversation");
  if (!(await adIsLive(conv.listingId, now))) throw new ForbiddenError(CHAT_AD_NOT_LIVE);
  const text = cleanChatText(input.text);
  if (!text && !input.image) throw new ValidationError("Write a message or add a photo");
  await assertUnderRateLimit(userId, now);
  // H7.5: a chat message is activity; it brings an auto-away seller back to Online (a manual Off stays Off).
  await touchOwnPresence(userId, now);
  const imageUrl = input.image ? await storeChatImage(input.image) : undefined;
  const message = await ChatMessage.create({ conversationId: conv._id, senderId: userId, text, imageUrl, createdAt: now });
  await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: now, lastText: text ? text.slice(0, 200) : "Photo" } });
  return viewOf(message.toObject() as ChatMessageDoc & { _id: Types.ObjectId }, userId);
}

/** Messages in a conversation, oldest first. Reading marks the other side's messages as read. */
export async function listMessages(userId: string, conversationId: string, options: { after?: string } = {}) {
  await connectDb();
  const conv = await participantConversation(userId, conversationId);
  await ChatMessage.updateMany(
    { conversationId: conv._id, senderId: { $ne: userId }, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  const query: Record<string, unknown> = { conversationId: conv._id };
  const after = options.after ? new Date(options.after) : null;
  if (after && !Number.isNaN(after.getTime())) query.createdAt = { $gt: after };
  const rows = (await ChatMessage.find(query).sort({ createdAt: 1 }).limit(CHAT_PAGE).lean()) as (ChatMessageDoc & { _id: Types.ObjectId })[];
  return {
    conversation: {
      id: conv._id.toString(),
      listingId: conv.listingId.toString(),
      listingTitle: conv.listingTitle,
      role: conv.sellerId.toString() === userId ? ("seller" as const) : ("buyer" as const),
      blocked: conv.blocked,
      reported: Boolean(conv.reportedAt),
      adLive: await adIsLive(conv.listingId),
    },
    messages: rows.map((row) => viewOf(row, userId)),
  };
}

/** The user's conversations, newest first, with unread counts. Only ad titles are shown, never contact details. */
export async function listInbox(userId: string): Promise<ConversationView[]> {
  await connectDb();
  const rows = (await Conversation.find({ $or: [{ sellerId: userId }, { buyerId: userId }] })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean()) as Conv[];
  if (rows.length === 0) return [];
  const unread = await ChatMessage.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        conversationId: { $in: rows.map((row) => row._id) },
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        readAt: { $exists: false },
        deletedAt: { $exists: false },
      },
    },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);
  const counts = new Map(unread.map((row) => [row._id.toString(), row.count]));
  const peers = await peerNames(rows, userId);
  const ads = await adSummaries(rows.map((row) => row.listingId));
  return rows.map((row) => ({
    id: row._id.toString(),
    listingId: row.listingId.toString(),
    listingTitle: row.listingTitle,
    role: row.sellerId.toString() === userId ? "seller" : "buyer",
    lastText: row.lastText,
    lastMessageAt: row.lastMessageAt.toISOString(),
    unread: counts.get(row._id.toString()) ?? 0,
    blocked: row.blocked,
    peerName: peers.get((row.sellerId.toString() === userId ? row.buyerId : row.sellerId).toString()) ?? "Member",
    cover: ads.get(row.listingId.toString())?.cover ?? null,
    adSlug: ads.get(row.listingId.toString())?.slug ?? null,
    adLive: ads.get(row.listingId.toString())?.live ?? false,
    adPrice: ads.get(row.listingId.toString())?.price ?? null,
  }));
}

async function peerNames(rows: Conv[], userId: string) {
  const ids = rows.map((row) => (row.sellerId.toString() === userId ? row.buyerId : row.sellerId));
  const users = (await User.find({ _id: { $in: ids } })
    .select("displayName sellerProfile.name")
    .lean()) as { _id: Types.ObjectId; displayName?: string; sellerProfile?: { name?: string } | null }[];
  return new Map(
    users.map((user) => {
      const named = (user.sellerProfile?.name || user.displayName || "").trim();
      return [user._id.toString(), named && !named.includes("@") ? named : "Member"] as const;
    }),
  );
}

async function adSummaries(listingIds: Types.ObjectId[]) {
  const listings = (await Listing.find({ _id: { $in: listingIds } })
    .select("slug status coverMediaId mediaIds price")
    .lean()) as { _id: Types.ObjectId; slug?: string; status: string; coverMediaId?: Types.ObjectId; mediaIds?: Types.ObjectId[]; price?: number }[];
  const coverIds = listings.map((listing) => listing.coverMediaId ?? listing.mediaIds?.[0]).filter((id): id is Types.ObjectId => Boolean(id));
  const assets = coverIds.length ? await MediaAsset.find({ _id: { $in: coverIds }, kind: "image" }).select("kind objectKey").lean() : [];
  const urls = new Map(assets.map((asset) => [asset._id.toString(), previewUrlOf(asset).url] as const));
  return new Map(
    listings.map((listing) => {
      const coverId = listing.coverMediaId ?? listing.mediaIds?.[0];
      return [listing._id.toString(), { slug: listing.slug ?? null, live: listing.status === "active", cover: coverId ? urls.get(coverId.toString()) ?? null : null, price: typeof listing.price === "number" ? listing.price : null }] as const;
    }),
  );
}

export async function unreadCount(userId: string) {
  await connectDb();
  const mine = await Conversation.find({ $or: [{ sellerId: userId }, { buyerId: userId }] }).select("_id").lean();
  if (mine.length === 0) return 0;
  return ChatMessage.countDocuments({
    conversationId: { $in: mine.map((row) => row._id) },
    senderId: { $ne: userId },
    readAt: { $exists: false },
    deletedAt: { $exists: false },
  });
}

/** Either side can block. Nobody can send in a blocked conversation. */
export async function blockConversation(userId: string, conversationId: string, requestId: string = randomUUID()) {
  await connectDb();
  const conv = await participantConversation(userId, conversationId);
  await Conversation.updateOne({ _id: conv._id }, { $set: { blocked: true, blockedBy: userId, blockedAt: new Date() } });
  await audit.append({ actorId: userId, actorType: "user", action: "chat.block", targetType: "conversation", targetId: conv._id.toString(), requestId });
  return { blocked: true as const };
}

/** Reporting flags the conversation so staff may read it. Reports never expose the chat to anyone else. */
export async function reportConversation(
  userId: string,
  conversationId: string,
  input: { reason?: unknown },
  requestId: string = randomUUID(),
) {
  await connectDb();
  const conv = await participantConversation(userId, conversationId);
  const reason = cleanChatText(input.reason).slice(0, 300) || "Reported";
  if (conv.reportedAt) throw new ConflictError("This conversation is already reported");
  await Conversation.updateOne({ _id: conv._id }, { $set: { reportedAt: new Date(), reportedBy: userId, reportReason: reason } });
  await audit.append({ actorId: userId, actorType: "user", action: "chat.report", targetType: "conversation", targetId: conv._id.toString(), reason, requestId });
  return { reported: true as const };
}

type Staff = { email: string; roles: string[] };

function assertStaff(actor: Staff) {
  if (!isStaffRole(actor.roles)) throw new ForbiddenError("Not allowed");
}

async function staffId(email: string) {
  const user = email ? await User.findOne({ email }).select("_id") : null;
  return user?._id?.toString() ?? null;
}

export async function listReportedConversations(actor: Staff) {
  assertStaff(actor);
  await connectDb();
  const rows = (await Conversation.find({ reportedAt: { $exists: true } }).sort({ reportedAt: -1 }).limit(100).lean()) as Conv[];
  return rows.map((row) => ({
    id: row._id.toString(),
    listingId: row.listingId.toString(),
    listingTitle: row.listingTitle,
    reportReason: row.reportReason ?? "",
    reportedAt: row.reportedAt?.toISOString() ?? "",
    blocked: row.blocked,
  }));
}

/** Staff can read a conversation only once someone has reported it. Every read is audited. */
export async function readReportedConversation(actor: Staff, conversationId: string, requestId: string = randomUUID()) {
  assertStaff(actor);
  assertId(conversationId, "Conversation not found");
  await connectDb();
  const conv = (await Conversation.findById(conversationId).lean()) as Conv | null;
  if (!conv) throw new NotFoundError("Conversation not found");
  if (!conv.reportedAt) throw new ForbiddenError("Staff can only read conversations that have been reported");
  await audit.append({
    actorId: await staffId(actor.email),
    actorType: "admin",
    action: "chat.admin_read",
    targetType: "conversation",
    targetId: conv._id.toString(),
    requestId,
  });
  const rows = (await ChatMessage.find({ conversationId: conv._id }).sort({ createdAt: 1 }).limit(500).lean()) as (ChatMessageDoc & { _id: Types.ObjectId })[];
  return {
    conversation: { id: conv._id.toString(), listingTitle: conv.listingTitle, reportReason: conv.reportReason ?? "" },
    messages: rows.map((row) => ({
      id: row._id.toString(),
      from: row.senderId.toString() === conv.sellerId.toString() ? ("seller" as const) : ("buyer" as const),
      text: row.deletedAt ? "" : row.text,
      imageUrl: row.deletedAt ? null : (row.imageUrl ?? null),
      createdAt: (row.createdAt ?? new Date()).toISOString(),
      deleted: Boolean(row.deletedAt),
    })),
  };
}

/** Staff delete a single message in a reported conversation. The text and image are cleared. */
export async function deleteChatMessage(actor: Staff, messageId: string, requestId: string = randomUUID()) {
  assertStaff(actor);
  assertId(messageId, "Message not found");
  await connectDb();
  const message = await ChatMessage.findById(messageId);
  if (!message) throw new NotFoundError("Message not found");
  const conv = (await Conversation.findById(message.conversationId).select("reportedAt").lean()) as { reportedAt?: Date } | null;
  if (!conv?.reportedAt) throw new ForbiddenError("Staff can only change conversations that have been reported");
  message.text = "";
  message.imageUrl = undefined;
  message.deletedAt = new Date();
  await message.save();
  await audit.append({
    actorId: await staffId(actor.email),
    actorType: "admin",
    action: "chat.message_delete",
    targetType: "chat_message",
    targetId: message._id.toString(),
    requestId,
  });
  return { deleted: true as const };
}
