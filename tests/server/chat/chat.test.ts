import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET, POST, DELETE } from "@/app/api/chat/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import {
  CHAT_RATE_LIMIT,
  CHAT_RATE_WINDOW_MS,
  blockConversation,
  deleteChatMessage,
  listInbox,
  listMessages,
  readReportedConversation,
  reportConversation,
  sendMessage,
  startConversation,
  unreadCount,
} from "@/server/chat/service";
import { imageMatchesType } from "@/server/chat/image";
import { AuditEvent, Listing, Session, User } from "@/server/models";
import { Conversation } from "@/server/models/conversation";
import { ChatMessage } from "@/server/models/message-chat";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const written: string[] = [];

async function account(email: string, roles = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "unsubmitted",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), email, roles, cookie: `sid=${encodeURIComponent(token)}` };
}

async function activeAd(ownerId: string, status: "active" | "draft" = "active") {
  const doc = await Listing.create({ ownerId, categoryId: new mongoose.Types.ObjectId(), title: "Wooden desk", description: "A desk", status });
  return doc._id.toString();
}

async function chat() {
  const seller = await account("seller@example.com");
  const buyer = await account("buyer@example.com");
  const listingId = await activeAd(seller.id);
  const { conversationId } = await startConversation(buyer.id, listingId);
  return { seller, buyer, listingId, conversationId };
}

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

beforeAll(async () => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.VERCEL;
  await connectMemoryMongo();
  await Conversation.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterEach(async () => {
  for (const file of written.splice(0)) await rm(path.join(process.cwd(), "public", "uploads", file), { force: true });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("starting a chat", () => {
  it("opens one conversation per buyer and ad, and returns the same one again", async () => {
    const { buyer, listingId, conversationId } = await chat();
    expect((await startConversation(buyer.id, listingId)).conversationId).toBe(conversationId);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("refuses your own ad and ads that are not live", async () => {
    const seller = await account("seller@example.com");
    const mine = await activeAd(seller.id);
    await expect(startConversation(seller.id, mine)).rejects.toThrow(/own ad/);
    const buyer = await account("buyer@example.com");
    await expect(startConversation(buyer.id, await activeAd(seller.id, "draft"))).rejects.toThrow(/not open/);
    await expect(startConversation(buyer.id, "nope")).rejects.toThrow();
  });
});

describe("messages", () => {
  it("delivers text both ways, counts unread, and marks read when opened", async () => {
    const { seller, buyer, conversationId } = await chat();
    await sendMessage(buyer.id, conversationId, { text: "<b>Is it</b> available?" });
    await sendMessage(buyer.id, conversationId, { text: "Hello again" });
    expect(await unreadCount(seller.id)).toBe(2);
    expect(await unreadCount(buyer.id)).toBe(0);
    const inbox = await listInbox(seller.id);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ unread: 2, role: "seller", listingTitle: "Wooden desk" });
    const read = await listMessages(seller.id, conversationId);
    expect(read.messages.map((message) => message.text)).toEqual(["Is it available?", "Hello again"]);
    expect(read.messages.every((message) => !message.mine)).toBe(true);
    expect(await unreadCount(seller.id)).toBe(0);
    await sendMessage(seller.id, conversationId, { text: "Yes" });
    const after = await listMessages(buyer.id, conversationId, { after: read.messages[1].createdAt });
    expect(after.messages.map((message) => message.text)).toEqual(["Yes"]);
  });

  it("rejects empty messages and outsiders", async () => {
    const { buyer, conversationId } = await chat();
    const stranger = await account("stranger@example.com");
    await expect(sendMessage(stranger.id, conversationId, { text: "hi" })).rejects.toThrow(/not found/i);
    await expect(listMessages(stranger.id, conversationId)).rejects.toThrow(/not found/i);
    await expect(sendMessage(buyer.id, conversationId, { text: "   " })).rejects.toThrow();
  });

  it("never exposes phone or email in what it returns", async () => {
    const { seller, buyer, conversationId } = await chat();
    await User.updateOne({ _id: seller.id }, { $set: { phone: "+911234567890" } });
    await sendMessage(buyer.id, conversationId, { text: "hello" });
    const everything = JSON.stringify([await listInbox(seller.id), await listMessages(seller.id, conversationId), await listInbox(buyer.id)]);
    expect(everything).not.toContain("@example.com");
    expect(everything).not.toContain("1234567890");
  });

  it("limits a user to 30 messages per 10 minutes", async () => {
    const { buyer, conversationId } = await chat();
    const start = new Date("2026-11-13T10:00:00Z");
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await sendMessage(buyer.id, conversationId, { text: `m${i}` }, start);
    await expect(sendMessage(buyer.id, conversationId, { text: "one more" }, new Date(start.getTime() + 1000))).rejects.toThrow(/too fast/);
    const later = new Date(start.getTime() + CHAT_RATE_WINDOW_MS + 1000);
    await expect(sendMessage(buyer.id, conversationId, { text: "later" }, later)).resolves.toMatchObject({ text: "later" });
  });
});

describe("photos", () => {
  it("stores a real image, and refuses wrong types, fake files and files over 5 MB", async () => {
    const { buyer, conversationId } = await chat();
    const sent = await sendMessage(buyer.id, conversationId, { text: "", image: { type: "image/png", data: png } });
    expect(sent.imageUrl).toMatch(/^\/uploads\/[a-f0-9]{24}\.png$/);
    written.push(path.basename(sent.imageUrl!));
    await expect(sendMessage(buyer.id, conversationId, { image: { type: "image/gif", data: png } })).rejects.toThrow(/5 MB/);
    await expect(sendMessage(buyer.id, conversationId, { image: { type: "image/png", data: Buffer.from("not an image at all") } })).rejects.toThrow(/5 MB/);
    await expect(
      sendMessage(buyer.id, conversationId, { image: { type: "image/png", data: Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]) } }),
    ).rejects.toThrow(/5 MB/);
    expect(imageMatchesType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
  });
});

describe("block and report", () => {
  it("stops all sending once blocked, from either side", async () => {
    const { seller, buyer, conversationId } = await chat();
    await blockConversation(seller.id, conversationId);
    await expect(sendMessage(buyer.id, conversationId, { text: "please" })).rejects.toThrow(/no longer/);
    await expect(sendMessage(seller.id, conversationId, { text: "hello" })).rejects.toThrow(/no longer/);
    expect((await listMessages(buyer.id, conversationId)).conversation.blocked).toBe(true);
    expect(await AuditEvent.countDocuments({ action: "chat.block" })).toBe(1);
  });

  it("lets staff read only a reported conversation, audits the read, and deletes messages", async () => {
    const { buyer, conversationId } = await chat();
    const admin = { email: "admin@example.com", roles: ["admin"] };
    const sent = await sendMessage(buyer.id, conversationId, { text: "something bad" });
    await expect(readReportedConversation(admin, conversationId)).rejects.toThrow(/reported/);
    await expect(deleteChatMessage(admin, sent.id)).rejects.toThrow(/reported/);
    await reportConversation(buyer.id, conversationId, { reason: "abuse" });
    await expect(reportConversation(buyer.id, conversationId, { reason: "again" })).rejects.toThrow(/already/);
    const read = await readReportedConversation(admin, conversationId);
    expect(read.messages[0]).toMatchObject({ text: "something bad", from: "buyer" });
    expect(await AuditEvent.countDocuments({ action: "chat.admin_read" })).toBe(1);
    await deleteChatMessage(admin, sent.id);
    expect((await ChatMessage.findById(sent.id))?.text).toBe("");
    expect(await AuditEvent.countDocuments({ action: "chat.message_delete" })).toBe(1);
    expect((await listMessages(buyer.id, conversationId)).messages[0]).toMatchObject({ deleted: true, text: "" });
    const user = { email: "u@example.com", roles: ["user"] };
    await expect(readReportedConversation(user, conversationId)).rejects.toThrow(/allowed/);
    await expect(deleteChatMessage(user, sent.id)).rejects.toThrow(/allowed/);
  });
});

describe("chat API", () => {
  function call(handler: typeof GET, url: string, cookie?: string, init: RequestInit = {}) {
    return handler(
      new Request(`${origin}${url}`, { ...init, headers: { origin, ...(cookie ? { cookie } : {}), ...(init.body ? { "content-type": "application/json" } : {}) } }),
    );
  }

  it("asks signed-out visitors to sign in", async () => {
    const res = await call(POST, "/api/chat/conversations", undefined, { method: "POST", body: JSON.stringify({ listingId: "x" }) });
    expect(res.status).toBe(401);
  });

  it("runs a conversation end to end for signed-in users", async () => {
    const seller = await account("seller@example.com");
    const buyer = await account("buyer@example.com");
    const listingId = await activeAd(seller.id);
    const started = await call(POST, "/api/chat/conversations", buyer.cookie, { method: "POST", body: JSON.stringify({ listingId }) });
    const { conversationId } = (await started.json()).data;
    const sent = await call(POST, `/api/chat/conversations/${conversationId}/messages`, buyer.cookie, { method: "POST", body: JSON.stringify({ text: "Hi" }) });
    expect(sent.status).toBe(200);
    const unread = await (await call(GET, "/api/chat/unread", seller.cookie)).json();
    expect(unread.data.unread).toBe(1);
    const inbox = await (await call(GET, "/api/chat/conversations", seller.cookie)).json();
    expect(inbox.data[0].unread).toBe(1);
    const forged = await POST(
      new Request(`${origin}/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: "x" }),
        headers: { origin: "https://evil.example", cookie: buyer.cookie, "content-type": "application/json" },
      }),
    );
    expect(forged.status).toBe(403);
    const admin = await account("admin@example.com", ["admin"]);
    const blocked = await call(GET, `/api/chat/admin/conversations/${conversationId}`, admin.cookie);
    expect(blocked.status).toBe(403);
    await call(POST, `/api/chat/conversations/${conversationId}/report`, buyer.cookie, { method: "POST", body: JSON.stringify({ reason: "spam" }) });
    const readable = await call(GET, `/api/chat/admin/conversations/${conversationId}`, admin.cookie);
    expect(readable.status).toBe(200);
    const messageId = (await readable.json()).data.messages[0].id;
    expect((await call(DELETE, `/api/chat/admin/messages/${messageId}`, admin.cookie, { method: "DELETE" })).status).toBe(200);
    expect((await call(DELETE, `/api/chat/admin/messages/${messageId}`, buyer.cookie, { method: "DELETE" })).status).toBe(403);
  });
});
