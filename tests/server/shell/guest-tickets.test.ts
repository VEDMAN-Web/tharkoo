import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, RateLimitedError, ValidationError } from "@/server/http";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { guestReply, guestThread, issueGuestLink, openGuestTicket } from "@/server/support/guest";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const IP = "ip-hash-test";
const BODY = "My ad was removed and I do not know why.";
const NOW = new Date();

function open(overrides: Record<string, unknown> = {}, ipHash = IP) {
  return openGuestTicket(
    { name: "Asha", email: "asha@example.com", phone: "", topic: "my_ads", body: BODY, ...overrides },
    { ipHash, requestId: "req-guest" },
  );
}

/** A link for the ticket, as the email would carry it. */
async function linkFor(ticketId: string, now = NOW) {
  return issueGuestLink(ticketId, now);
}

beforeAll(async () => {
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
  process.env.SESSION_SECRET = "guest-test-secret-not-real";
  delete process.env.BREVO_API_KEY;
});

afterAll(async () => {
  delete process.env.SESSION_SECRET;
  await disconnectMemoryMongo();
});

describe("H7.1 guest tickets: opening", () => {
  it("opens a ticket with no account and records the guest details", async () => {
    const result = await open();
    expect(result.replyVia).toBe("email");
    expect(result.emailed).toBe(false);
    const ticket = await SupportTicket.findById(result.id).lean();
    expect(ticket?.ownerKind).toBe("guest");
    expect(ticket?.ownerId).toBeFalsy();
    expect(ticket?.guestName).toBe("Asha");
    expect(ticket?.guestEmail).toBe("asha@example.com");
    const first = await TicketMessage.findOne({ ticketId: ticket?._id, opening: true }).lean();
    expect(first?.authorType).toBe("user");
    expect(first?.author).toBeNull();
  });

  it("accepts a phone number alone and reports the phone route", async () => {
    const result = await open({ email: "", phone: "+91 98765 43210" });
    expect(result.replyVia).toBe("phone");
    const ticket = await SupportTicket.findById(result.id).lean();
    expect(ticket?.guestPhone).toBe("+919876543210");
    expect(ticket?.guestEmail).toBeFalsy();
  });

  it("refuses a ticket with no contact or a broken email", async () => {
    await expect(open({ email: "", phone: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(open({ email: "not-an-email" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("limits tickets per contact", async () => {
    await open();
    await open({}, "other-ip-1");
    await open({}, "other-ip-2");
    await expect(open({}, "other-ip-3")).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("limits tickets per client address", async () => {
    for (let i = 0; i < 5; i += 1) await open({ email: `person${i}@example.com` }, IP);
    await expect(open({ email: "person9@example.com" }, IP)).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("H7.1 guest tickets: link in the path", () => {
  it("a link token opens only the ticket it was issued for", async () => {
    const mine = await open({ email: "mine@example.com" });
    const theirs = await open({ email: "theirs@example.com" }, "other-ip");
    const myToken = await linkFor(mine.id);
    const thread = await guestThread({ t: myToken });
    expect(thread.ticket.id).toBe(mine.id);
    const otherToken = await linkFor(theirs.id);
    expect((await guestThread({ t: otherToken })).ticket.id).toBe(theirs.id);
    // A token that belongs to nobody gives nothing.
    await expect(guestThread({ t: "a".repeat(40) })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a malformed token", async () => {
    await expect(guestThread({ t: "short" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(guestThread({})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses an expired link", async () => {
    const result = await open();
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const token = await linkFor(result.id, old);
    await expect(guestThread({ t: token })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a newer link replaces the older one", async () => {
    const result = await open();
    const first = await linkFor(result.id);
    const second = await linkFor(result.id);
    await expect(guestThread({ t: first })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await guestThread({ t: second })).ticket.id).toBe(result.id);
  });

  it("the token is stored only as a hash", async () => {
    const result = await open();
    const token = await linkFor(result.id);
    const ticket = await SupportTicket.findById(result.id).lean();
    expect(JSON.stringify(ticket)).not.toContain(token);
  });

  it("without a secret the contact hash still works, and nothing is shown with a wrong token", async () => {
    const result = await open();
    delete process.env.SESSION_SECRET;
    await expect(guestThread({ t: "a".repeat(40) })).rejects.toBeInstanceOf(ForbiddenError);
    expect(result.id).toBeTruthy();
  });
});

describe("H7.1 guest tickets: replies", () => {
  it("the guest reply joins the thread and reopens it for staff", async () => {
    const result = await open();
    const token = await linkFor(result.id);
    await guestReply({ t: token, body: "Here is more detail about the ad." }, "req-reply");
    const thread = await guestThread({ t: token });
    expect(thread.messages.map((item) => item.body)).toEqual([BODY, "Here is more detail about the ad."]);
    const ticket = await SupportTicket.findById(result.id).lean();
    expect(ticket?.unreadForStaff).toBe(true);
    expect(ticket?.status).toBe("waiting_for_support");
  });

  it("a reply without a valid link is refused", async () => {
    const result = await open();
    await expect(guestReply({ t: "", body: "Hello there" }, "req-reply")).rejects.toBeInstanceOf(ForbiddenError);
    expect(result.id).toBeTruthy();
  });

  it("a closed ticket refuses a guest reply", async () => {
    const result = await open();
    await SupportTicket.updateOne({ _id: result.id }, { $set: { status: "closed", closedAt: new Date() } });
    const token = await linkFor(result.id);
    await expect(guestReply({ t: token, body: "Still there?" }, "req-reply")).rejects.toBeInstanceOf(ConflictError);
  });

  it("the thread never returns internal notes", async () => {
    const result = await open();
    const ticket = await SupportTicket.findById(result.id).lean();
    await TicketMessage.create({ ticketId: ticket?._id, authorType: "staff", author: null, body: "internal only", attachments: [], internal: true, opening: false });
    const token = await linkFor(result.id);
    const thread = await guestThread({ t: token });
    expect(thread.messages.some((item) => item.body === "internal only")).toBe(false);
  });
});
