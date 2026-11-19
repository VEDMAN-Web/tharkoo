import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/chat/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { listMessages, sendMessage, startConversation } from "@/server/chat/service";
import { ForbiddenError } from "@/server/http";
import { Listing, Session, User } from "@/server/models";
import { Conversation } from "@/server/models/conversation";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** FIX-3 (E1-B7): a chat about an ad that is removed, expired or paused is read-only. The server refuses a new message with 403 and a friendly sentence. */

const origin = "http://127.0.0.1:4317";
const SENTENCE = "This ad is no longer live, so you can read this chat but not reply.";

async function account(email: string) {
  const user = await User.create({ email, passwordHash: "hash", displayName: "Ada", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date(), emailVerifiedAt: new Date(), roles: ["user"], verificationStatus: "unsubmitted", status: "active" });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

function call(handler: typeof GET, url: string, cookie: string, init: RequestInit = {}) {
  return handler(new Request(`${origin}${url}`, { ...init, headers: { origin, cookie, ...(init.body ? { "content-type": "application/json" } : {}) } }));
}

async function chatAbout() {
  const seller = await account("seller@example.com");
  const buyer = await account("buyer@example.com");
  const ad = await Listing.create({ ownerId: seller.id, categoryId: new mongoose.Types.ObjectId(), title: "Wooden desk", description: "A desk", status: "active" });
  const { conversationId } = await startConversation(buyer.id, ad._id.toString());
  await sendMessage(buyer.id, conversationId, { text: "Is it still free?" });
  return { seller, buyer, ad, conversationId };
}

beforeAll(async () => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.VERCEL;
  await connectMemoryMongo();
  await Conversation.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("FIX-3: a chat about an ad that is not live is read-only", () => {
  for (const status of ["paused", "removed", "expired", "deleted", "archived"] as const) {
    it(`refuses a new message when the ad is ${status}, with 403 and the sentence, and still lets both sides read`, async () => {
      const { seller, buyer, ad, conversationId } = await chatAbout();
      await Listing.updateOne({ _id: ad._id }, { $set: { status } });
      for (const side of [buyer, seller]) {
        const res = await call(POST, `/api/chat/conversations/${conversationId}/messages`, side.cookie, { method: "POST", body: JSON.stringify({ text: "Hello?" }) });
        expect(res.status).toBe(403);
        expect(JSON.stringify(await res.json())).toContain(SENTENCE);
      }
      const read = await listMessages(buyer.id, conversationId);
      expect(read.messages).toHaveLength(1);
      expect(read.conversation.adLive).toBe(false);
    });
  }

  it("refuses a new message when the ad is still marked active but its end date has passed (expired)", async () => {
    const { buyer, ad, conversationId } = await chatAbout();
    await Listing.updateOne({ _id: ad._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
    await expect(sendMessage(buyer.id, conversationId, { text: "Hello?" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listMessages(buyer.id, conversationId)).conversation.adLive).toBe(false);
  });

  it("refuses a new message when the ad document is gone", async () => {
    const { buyer, ad, conversationId } = await chatAbout();
    await Listing.deleteOne({ _id: ad._id });
    await expect(sendMessage(buyer.id, conversationId, { text: "Hello?" })).rejects.toThrow(SENTENCE);
  });

  it("a live ad still takes messages, and says it is live", async () => {
    const { seller, buyer, conversationId } = await chatAbout();
    const sent = await sendMessage(seller.id, conversationId, { text: "Yes, it is free." });
    expect(sent.text).toBe("Yes, it is free.");
    expect((await listMessages(buyer.id, conversationId)).conversation.adLive).toBe(true);
  });

  it("an ad that goes live again takes messages again", async () => {
    const { buyer, ad, conversationId } = await chatAbout();
    await Listing.updateOne({ _id: ad._id }, { $set: { status: "paused" } });
    await expect(sendMessage(buyer.id, conversationId, { text: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await Listing.updateOne({ _id: ad._id }, { $set: { status: "active" } });
    await expect(sendMessage(buyer.id, conversationId, { text: "Back again" })).resolves.toBeTruthy();
  });
});
