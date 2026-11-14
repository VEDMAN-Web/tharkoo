import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEvent, Listing, User } from "@/server/models";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { SupportAttachment } from "@/server/models/support-attachment";
import { attachmentFor } from "@/server/support/attachments";
import { deskAssign, deskClose, deskQueue, deskReopen, deskReply, deskSetStatus, deskSummary, deskThread } from "@/server/support/desk";
import { cleanSupportText } from "@/server/support/text";
import { screenshotsFrom } from "@/server/support/attachments";
import { SCREENSHOT_MAX_BYTES, TICKET_OPEN_LIMIT, TICKET_REPLY_LIMIT } from "@/server/support/constants";
import { ownerCannotClose, listMyTickets, myThread, openTicket, replyAsOwner, unreadForOwner } from "@/server/support/tickets";
import { queueQuerySchema, statusSchema, ticketCreateSchema, replySchema, assignSchema } from "@/server/support/schemas";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const ticketInput = { topic: "my_account" as const, subject: "Cannot log in", body: "The reset email never arrives for me." };

async function person(email: string, roles: string[] = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: email.split("@")[0],
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "unsubmitted",
    status: "active",
  });
  return { id: user._id.toString(), roles };
}

async function openFor(userId: string, input = ticketInput) {
  const made = await openTicket(userId, input, [], "req-open");
  return made.id;
}

function errorOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => error as { status?: number; code?: string; message: string },
  );
}

beforeAll(async () => {
  await connectMemoryMongo();
  await Promise.all([SupportTicket.init(), TicketMessage.init(), SupportAttachment.init()]);
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("owner-only access", () => {
  it("lists only the owner's tickets and never another person's", async () => {
    const ada = await person("ada@example.com");
    const ben = await person("ben@example.com");
    const mine = await openFor(ada.id);
    await openFor(ben.id);
    const rows = await listMyTickets(ada.id);
    expect(rows.map((row) => row.id)).toEqual([mine]);
  });

  it("returns not found for another person's ticket, for both reading and replying", async () => {
    const ada = await person("ada@example.com");
    const eve = await person("eve@example.com");
    const ticketId = await openFor(ada.id);
    expect((await errorOf(myThread(eve.id, ticketId))).status).toBe(404);
    const reply = await errorOf(replyAsOwner(eve.id, ticketId, { body: "hi", internal: false }, [], "req"));
    expect(reply.status).toBe(404);
  });

  it("gives an ad owner the vendor kind and everyone else the user kind", async () => {
    const seller = await person("seller@example.com");
    const buyer = await person("buyer@example.com");
    await Listing.create({ ownerId: seller.id, categoryId: new mongoose.Types.ObjectId(), title: "Desk", description: "A desk", status: "active" });
    const sellerTicket = await openFor(seller.id);
    const buyerTicket = await openFor(buyer.id);
    expect((await SupportTicket.findById(sellerTicket))?.ownerKind).toBe("vendor");
    expect((await SupportTicket.findById(buyerTicket))?.ownerKind).toBe("user");
  });
});

describe("internal notes", () => {
  it("are hidden from the owner and visible to staff", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const ticketId = await openFor(ada.id);
    await deskReply({ id: agent.id, roles: agent.roles }, ticketId, { body: "Customer uses an old phone", internal: true }, [], "req-note");
    await deskReply({ id: agent.id, roles: agent.roles }, ticketId, { body: "Try the reset link again", internal: false }, [], "req-reply");

    const owner = await myThread(ada.id, ticketId);
    expect(owner.messages.map((message) => message.body)).toEqual([ticketInput.body, "Try the reset link again"]);
    expect(owner.messages.some((message) => message.internal)).toBe(false);

    const staff = await deskThread({ id: agent.id, roles: agent.roles }, ticketId, "req-view");
    expect(staff.messages.map((message) => message.internal)).toEqual([false, true, false]);
  });

  it("cannot be written by the owner, whatever the request says", async () => {
    const ada = await person("ada@example.com");
    const ticketId = await openFor(ada.id);
    await replyAsOwner(ada.id, ticketId, { body: "Still stuck", internal: true }, [], "req");
    const stored = await TicketMessage.find({ ticketId }).lean();
    expect(stored.every((row) => row.internal === false || row.authorType === "staff")).toBe(true);
  });
});

describe("owners cannot close, and closed tickets", () => {
  it("refuses a close from the owner with a 403", async () => {
    const error = await errorOf(Promise.resolve().then(() => ownerCannotClose()));
    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("refuses owner replies on a closed ticket, and staff can reopen it", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["admin"]);
    const actor = { id: agent.id, roles: agent.roles };
    const ticketId = await openFor(ada.id);
    await deskClose(actor, ticketId, "req-close");
    const refused = await errorOf(replyAsOwner(ada.id, ticketId, { body: "Hello?", internal: false }, [], "req"));
    expect(refused.status).toBe(409);
    expect(refused.message).toMatch(/closed/);

    await deskReopen(actor, ticketId, "req-reopen");
    const row = await SupportTicket.findById(ticketId).lean();
    expect(row?.status).toBe("open");
    expect(row?.closedAt).toBeNull();
    await replyAsOwner(ada.id, ticketId, { body: "Hello again", internal: false }, [], "req");
    expect((await SupportTicket.findById(ticketId).lean())?.status).toBe("waiting_for_support");
  });

  it("does not let staff reply to the customer on a closed ticket until it is reopened", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const actor = { id: agent.id, roles: agent.roles };
    const ticketId = await openFor(ada.id);
    await deskClose(actor, ticketId, "req");
    const error = await errorOf(deskReply(actor, ticketId, { body: "Closed now", internal: false }, [], "req"));
    expect(error.status).toBe(409);
    await expect(deskReopen(actor, ticketId, "req")).resolves.toMatchObject({ status: "open" });
  });
});

describe("staff permissions and audit", () => {
  it("lets only the desk roles in and refuses other staff and plain users", async () => {
    const trust = await person("trust@example.com", ["trust_safety"]);
    const plain = await person("plain@example.com");
    await expect(deskQueue({ id: trust.id, roles: trust.roles }, queueQuerySchema.parse({}))).rejects.toMatchObject({ status: 403 });
    await expect(deskQueue({ id: plain.id, roles: plain.roles }, queueQuerySchema.parse({}))).rejects.toMatchObject({ status: 403 });
    await expect(deskQueue(null, queueQuerySchema.parse({}))).rejects.toMatchObject({ status: 401 });
  });

  it("accepts moderator, support, admin and superadmin for replies", async () => {
    const ada = await person("ada@example.com");
    const ticketId = await openFor(ada.id);
    for (const role of ["support", "moderator", "admin", "superadmin"]) {
      const agent = await person(`${role}@example.com`, [role]);
      await expect(deskReply({ id: agent.id, roles: agent.roles }, ticketId, { body: `From ${role}`, internal: false }, [], "req")).resolves.toMatchObject({
        authorType: "staff",
      });
    }
  });

  it("writes an audit row for every status change, assignment, close and reopen", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const actor = { id: agent.id, roles: agent.roles };
    const ticketId = await openFor(ada.id);
    await deskSetStatus(actor, ticketId, "open", "req-status");
    await deskAssign(actor, ticketId, "me", "req-assign");
    await deskClose(actor, ticketId, "req-close");
    await deskReopen(actor, ticketId, "req-reopen");
    const actions = (await AuditEvent.find({ targetId: ticketId }).sort({ createdAt: 1 }).lean()).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["support.open", "support.status", "support.assign", "support.close", "support.reopen"]));
    const status = await AuditEvent.findOne({ targetId: ticketId, action: "support.status" }).lean();
    expect(status).toMatchObject({ actorType: "admin", before: { status: "waiting_for_support" }, after: { status: "open" } });
  });

  it("refuses an assignment to someone without a desk role", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const plain = await person("plain@example.com");
    const ticketId = await openFor(ada.id);
    const error = await errorOf(deskAssign({ id: agent.id, roles: agent.roles }, ticketId, plain.id, "req"));
    expect(error.status).toBe(400);
  });
});

describe("rate limits", () => {
  it("allows five tickets an hour and refuses the sixth", async () => {
    const ada = await person("ada@example.com");
    for (let index = 0; index < TICKET_OPEN_LIMIT; index += 1) await openFor(ada.id);
    const error = await errorOf(openTicket(ada.id, ticketInput, [], "req"));
    expect(error.status).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
  });

  it("limits replies per hour, and opening messages do not count", async () => {
    const ada = await person("ada@example.com");
    const ticketId = await openFor(ada.id);
    for (let index = 0; index < TICKET_REPLY_LIMIT; index += 1) {
      await replyAsOwner(ada.id, ticketId, { body: `Reply ${index}`, internal: false }, [], "req");
    }
    const error = await errorOf(replyAsOwner(ada.id, ticketId, { body: "One more", internal: false }, [], "req"));
    expect(error.status).toBe(429);
  });
});

describe("unread marks on both sides", () => {
  it("marks the owner after a staff reply and clears it when the thread is opened", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const ticketId = await openFor(ada.id);
    expect(await unreadForOwner(ada.id)).toBe(0);
    await deskReply({ id: agent.id, roles: agent.roles }, ticketId, { body: "We fixed it", internal: false }, [], "req");
    expect(await unreadForOwner(ada.id)).toBe(1);
    await myThread(ada.id, ticketId);
    expect(await unreadForOwner(ada.id)).toBe(0);
  });

  it("marks staff after a customer message and clears it when the desk opens the ticket", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const actor = { id: agent.id, roles: agent.roles };
    const ticketId = await openFor(ada.id);
    expect((await deskSummary(actor)).unread).toBe(1);
    await deskThread(actor, ticketId, "req");
    expect((await deskSummary(actor)).unread).toBe(0);
    await replyAsOwner(ada.id, ticketId, { body: "Any update?", internal: false }, [], "req");
    expect((await deskSummary(actor)).unread).toBe(1);
  });

  it("sorts the queue with customers waiting for support first, oldest first", async () => {
    const ada = await person("ada@example.com");
    const ben = await person("ben@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const actor = { id: agent.id, roles: agent.roles };
    const older = await openFor(ada.id);
    const newer = await openFor(ben.id);
    await deskReply(actor, older, { body: "Looking", internal: false }, [], "req");
    const queue = await deskQueue(actor, queueQuerySchema.parse({ status: "active" }));
    expect(queue.items.map((item) => item.id)).toEqual([newer, older]);
    const onlyWaiting = await deskQueue(actor, queueQuerySchema.parse({ status: "waiting_for_support" }));
    expect(onlyWaiting.items.map((item) => item.id)).toEqual([newer]);
  });
});

describe("status changes", () => {
  it("does not let staff set closed through the status call", () => {
    expect(statusSchema.safeParse({ status: "closed" }).success).toBe(false);
    expect(statusSchema.safeParse({ status: "waiting_for_user" }).success).toBe(true);
  });

  it("refuses to change the status of a closed ticket", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const actor = { id: agent.id, roles: agent.roles };
    const ticketId = await openFor(ada.id);
    await deskClose(actor, ticketId, "req");
    expect((await errorOf(deskSetStatus(actor, ticketId, "open", "req"))).status).toBe(409);
  });
});

describe("plain text and validation", () => {
  it("strips tags and control characters but keeps links as text", () => {
    expect(cleanSupportText("<b>Visit</b> https://example.com/x\u0007 now", 200)).toBe("Visit https://example.com/x now");
    expect(cleanSupportText(42, 200)).toBe("");
  });

  it("validates the create form at the boundary", () => {
    expect(ticketCreateSchema.safeParse({ topic: "nope", subject: "Hello", body: "Long enough body" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ topic: "my_ads", subject: "Hi", body: "Long enough body" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ topic: "my_ads", subject: "Hello", body: "<i>tags</i>" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ topic: "my_ads", subject: "Hello", body: "<i>tags only here</i>" }).success).toBe(true);
    expect(ticketCreateSchema.safeParse({ topic: "my_ads", subject: "Hello", body: "short" }).success).toBe(false);
    expect(replySchema.safeParse({ body: "ok" }).success).toBe(true);
    expect(assignSchema.safeParse({ assigneeId: "not-an-id" }).success).toBe(false);
    expect(assignSchema.safeParse({ assigneeId: "me" }).success).toBe(true);
  });
});

describe("screenshots", () => {
  function file(bytes: Buffer, name: string, type: string) {
    return new File([new Uint8Array(bytes)], name, { type });
  }

  function formWith(files: File[]) {
    const form = new FormData();
    for (const entry of files) form.append("screenshots", entry);
    return form;
  }

  it("accepts real PNG screenshots and stores them as attachments", async () => {
    const ada = await person("ada@example.com");
    const shots = await screenshotsFrom(formWith([file(PNG, "shot.png", "image/png")]));
    expect(shots).toHaveLength(1);
    const made = await openTicket(ada.id, ticketInput, shots, "req");
    const message = await TicketMessage.findOne({ ticketId: made.id }).lean();
    expect(message?.attachments).toHaveLength(1);
    expect(await SupportAttachment.countDocuments({ ticketId: made.id })).toBe(1);
  });

  it("refuses a file whose bytes are not an image of the claimed type", async () => {
    const fake = file(Buffer.from("<script>alert(1)</script>"), "shot.png", "image/png");
    await expect(screenshotsFrom(formWith([fake]))).rejects.toMatchObject({ status: 400 });
    const svg = file(PNG, "shot.svg", "image/svg+xml");
    await expect(screenshotsFrom(formWith([svg]))).rejects.toMatchObject({ status: 400 });
  });

  it("refuses more than three screenshots and any file over 5 MB", async () => {
    const four = [1, 2, 3, 4].map((n) => file(PNG, `shot-${n}.png`, "image/png"));
    await expect(screenshotsFrom(formWith(four))).rejects.toMatchObject({ status: 400 });
    const big = Buffer.concat([PNG, Buffer.alloc(SCREENSHOT_MAX_BYTES)]);
    await expect(screenshotsFrom(formWith([file(big, "big.png", "image/png")]))).rejects.toMatchObject({ status: 400 });
  });

  it("shows a screenshot to its owner only, and never on an internal note", async () => {
    const ada = await person("ada@example.com");
    const eve = await person("eve@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const shots = await screenshotsFrom(formWith([file(PNG, "shot.png", "image/png")]));
    const ticketId = await openFor(ada.id);
    const ids = await replyAsOwner(ada.id, ticketId, { body: "See this", internal: false }, shots, "req");
    const attachmentId = ids.attachments[0];
    expect(await attachmentFor({ id: ada.id, roles: ["user"] }, attachmentId)).not.toBeNull();
    expect(await attachmentFor({ id: eve.id, roles: ["user"] }, attachmentId)).toBeNull();
    expect(await attachmentFor({ id: agent.id, roles: ["support"] }, attachmentId)).not.toBeNull();

    const internalShots = await screenshotsFrom(formWith([file(PNG, "internal.png", "image/png")]));
    const note = await deskReply({ id: agent.id, roles: ["support"] }, ticketId, { body: "", internal: true }, internalShots, "req");
    expect(await attachmentFor({ id: ada.id, roles: ["user"] }, note.attachments[0])).toBeNull();
    expect(await attachmentFor({ id: agent.id, roles: ["support"] }, note.attachments[0])).not.toBeNull();
  });

  it("sends the owner's unread count only for their own tickets", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const ticketId = await openFor(ada.id);
    await deskReply({ id: agent.id, roles: ["support"] }, ticketId, { body: "Reply", internal: false }, [], "req");
    expect(await unreadForOwner(agent.id)).toBe(0);
    expect(await unreadForOwner(ada.id)).toBe(1);
  });
});
