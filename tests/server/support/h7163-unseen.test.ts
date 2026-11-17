import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ owner: vi.fn(), guest: vi.fn() }));
vi.mock("@/server/support/notify", () => ({ notifyOwnerOfReply: sent.owner }));
vi.mock("@/server/support/guest", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/support/guest")>()), notifyGuestOfReply: sent.guest }));

import { getAdminCounts } from "@/server/admin/counts";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { deskClose, deskReopen, deskSetStatus, deskThread } from "@/server/support/desk";
import { countUnseenTickets } from "@/server/support/unseen";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const actor = { id: "000000000000000000000081", roles: ["support"] };
const owner = new mongoose.Types.ObjectId();
let counter = 0;

async function ticket(extra: Record<string, unknown> = {}) {
  const now = new Date();
  const doc = new SupportTicket({ number: ++counter, ownerId: owner, ownerKind: "user", topic: "coins_payments", subject: `Question ${counter}`, status: "waiting_for_support", lastMessageAt: now, lastCustomerMessageAt: now, ...extra });
  await doc.save();
  return doc;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  sent.owner.mockClear();
  sent.guest.mockClear();
});

describe("H7.163 the red number counts tickets nobody has opened", () => {
  it("a new ticket counts, opening it clears it, and a new customer message makes it count again", async () => {
    const fresh = await ticket();
    expect(await countUnseenTickets()).toBe(1);
    expect((await getAdminCounts(["support"])).tickets).toBe(1);

    await deskThread(actor, String(fresh._id), "r1");
    expect(await countUnseenTickets()).toBe(0);
    expect((await getAdminCounts(["support"])).tickets).toBe(0);

    await SupportTicket.updateOne({ _id: fresh._id }, { $set: { lastStaffViewAt: new Date(Date.now() - 10_000), lastCustomerMessageAt: new Date(Date.now() - 1_000), status: "waiting_for_support" } });
    expect(await countUnseenTickets()).toBe(1);
    await deskThread(actor, String(fresh._id), "r2");
    expect(await countUnseenTickets()).toBe(0);
  });

  it("tickets already answered, closed, or opened by another staff member are not counted", async () => {
    await ticket({ status: "waiting_for_user" });
    await ticket({ status: "closed" });
    await ticket({ lastStaffViewAt: new Date(Date.now() + 1_000) });
    await ticket({ status: "open" });
    expect(await countUnseenTickets()).toBe(1);
  });
});

describe("H7.163 closing without a reply", () => {
  it("closes, sends nothing to the customer, adds no message, and reopening puts the earlier status back", async () => {
    const row = await ticket();
    const closed = await deskClose(actor, String(row._id), "r3");
    expect(closed).toMatchObject({ status: "closed", before: "waiting_for_support" });
    expect(sent.owner).not.toHaveBeenCalled();
    expect(sent.guest).not.toHaveBeenCalled();
    expect(await TicketMessage.countDocuments({ ticketId: row._id })).toBe(0);
    expect(await countUnseenTickets()).toBe(0);
    const stored = await SupportTicket.findById(row._id).lean();
    expect(stored?.status).toBe("closed");
    expect(String(stored?.closedBy)).toBe(actor.id);

    await deskReopen(actor, String(row._id), "r4");
    await deskSetStatus(actor, String(row._id), "waiting_for_support", "r5");
    expect((await SupportTicket.findById(row._id).lean())?.status).toBe("waiting_for_support");
  });
});
