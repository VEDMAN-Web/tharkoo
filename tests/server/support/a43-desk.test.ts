import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A race: the balance looks fine to adjustCredits, then the ledger refuses because the person spent credits in between.
vi.mock("@/server/billing/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/billing/ledger")>();
  return { ...actual, debitWallet: vi.fn(actual.debitWallet) };
});

import { REPLY_TEMPLATES, fillTemplate } from "@/app/admin/support/_desk/templates";
import { inOpenTab, latestOrder, matchesSearch, ownerIdOf, parseTab, tabCounts, tabStatus, userCard } from "@/app/admin/support/_desk/data";
import type { AdminCtx } from "@/server/admin/context";
import * as ledger from "@/server/billing/ledger";
import { adjustCredits } from "@/server/billing/staff-credits";
import { ConflictError, PaymentRequiredError } from "@/server/http";
import { Listing, Payment, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const support: AdminCtx = { actorId: "000000000000000000000081", email: "sup@example.com", roles: ["support"], requestId: "r-s" };
let counter = 0;

async function person(name: string) {
  return User.create({ email: `u${++counter}@example.com`, passwordHash: "x", displayName: name, roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01") });
}

async function ticket(ownerId: unknown, extra: Record<string, unknown> = {}) {
  const now = new Date();
  const doc = new SupportTicket({ number: ++counter, ownerId, ownerKind: "user", topic: "coins_payments", subject: "Credits not added", status: "waiting_for_support", lastMessageAt: now, lastCustomerMessageAt: now, ...extra });
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
});

describe("the tabs and the search", () => {
  it("maps the tabs to the queue, keeps the open tab to what the team must act on, and finds by number, subject or name", () => {
    expect([parseTab("waiting"), parseTab("closed"), parseTab("x"), parseTab(undefined)]).toEqual(["waiting", "closed", "open", "open"]);
    expect([tabStatus("open"), tabStatus("waiting"), tabStatus("closed")]).toEqual(["active", "waiting_for_user", "closed"]);
    expect(inOpenTab({ status: "waiting_for_support" })).toBe(true);
    expect(inOpenTab({ status: "open" })).toBe(true);
    expect(inOpenTab({ status: "waiting_for_user" })).toBe(false);
    const item = { number: 1042, subject: "Credits not added after payment", ownerName: "Rohan M." };
    expect(matchesSearch(item, "")).toBe(true);
    expect(matchesSearch(item, "#1042")).toBe(true);
    expect(matchesSearch(item, "credits")).toBe(true);
    expect(matchesSearch(item, "ROHAN")).toBe(true);
    expect(matchesSearch(item, "refund")).toBe(false);
  });

  it("counts each tab from the real tickets", async () => {
    const user = await person("Rohan");
    await ticket(user._id);
    await ticket(user._id, { status: "open" });
    await ticket(user._id, { status: "waiting_for_user" });
    await ticket(user._id, { status: "closed" });
    expect(await tabCounts()).toEqual({ open: 2, waiting: 1, closed: 1 });
  });
});

describe("the customer card", () => {
  it("shows the customer's numbers and what the viewer may do, and nothing for a guest", async () => {
    const user = await person("Rohan Mehta");
    await Payment.create({ userId: user._id, orderId: new mongoose.Types.ObjectId(), idempotencyKey: "a43-1", amount: 1000, currency: "INR", status: "pending", method: "crypto", credits: 100, provider: "real" });
    await Payment.create({ userId: user._id, orderId: new mongoose.Types.ObjectId(), idempotencyKey: "a43-2", amount: 500, currency: "INR", status: "paid", method: "card", credits: 50, provider: "real" });
    await Listing.collection.insertMany([{ ownerId: user._id, title: "A", status: "active", slug: "a-1", createdAt: new Date() }, { ownerId: user._id, title: "B", status: "paused", slug: "b-1", createdAt: new Date() }]);
    await ticket(user._id);
    const card = await userCard(String(user._id), ["support"]);
    expect(card).toMatchObject({ name: "Rohan Mehta", credits: 0, ordersWaiting: 1, ordersPaid: 1, adsLive: 1, ticketsOpen: 1, canAdjust: true, canOpenOrders: false });
    expect(await userCard(String(user._id), ["finance"])).toMatchObject({ canAdjust: true, canOpenOrders: true });
    expect(await userCard(String(user._id), ["moderator"])).toMatchObject({ canAdjust: false, canOpenOrders: false });
    expect(await userCard(null, ["support"])).toBeNull();
    expect(await userCard("0123456789abcdef01234567", ["support"])).toBeNull();
    const owner = await ownerIdOf(String((await SupportTicket.findOne({}).lean())!._id));
    expect(owner).toEqual({ ownerId: String(user._id), kind: "user" });
  });

  it("finds the newest recharge for a payment ticket, says TEST for a test payment, and shows the receipt link only to people who may open orders", async () => {
    const user = await person("Rohan");
    await Payment.create({ userId: user._id, orderId: new mongoose.Types.ObjectId(), idempotencyKey: "a43-3", amount: 1000, currency: "INR", status: "pending", method: "crypto", coin: "USDT", credits: 100, provider: "real", expiresAt: new Date(Date.now() + 3_600_000) });
    const order = await latestOrder(String(user._id), ["support"]);
    expect(order?.text).toMatch(/^Order TK-[0-9A-F]{8} · Crypto USDT · ₹1,000 · waiting for the network$/);
    expect(order?.receipt).toBeNull();
    expect((await latestOrder(String(user._id), ["finance"]))?.receipt).toMatch(/^\/admin\/finance\/receipt\/[0-9a-f]{24}\/$/);
    await Payment.create({ userId: user._id, orderId: new mongoose.Types.ObjectId(), idempotencyKey: "a43-4", amount: 200, currency: "INR", status: "paid", method: "card", credits: 20, provider: "mock", createdAt: new Date(Date.now() + 1000) });
    expect((await latestOrder(String(user._id), ["admin"]))?.text).toContain("(test payment)");
    expect(await latestOrder(null, ["admin"])).toBeNull();
    expect(await latestOrder(String((await person("Nobody"))._id), ["admin"])).toBeNull();
  });
});

describe("ready-made replies", () => {
  it("fill in the customer's first name, have no dashes, and unknown keys give nothing", () => {
    expect(fillTemplate("credits-added", "Rohan Mehta")).toContain("Hi Rohan,");
    expect(fillTemplate("credits-added", "")).toContain("Hi there,");
    expect(fillTemplate("nope", "Rohan")).toBe("");
    for (const template of REPLY_TEMPLATES) {
      expect(template.body).not.toMatch(/[–—]/);
      expect(template.body).not.toMatch(/\b(seller|vendor|buyer)\b/i);
    }
  });
});

describe("Add credits from the desk: a race on the remove path", () => {
  it("turns the ledger's raw 'Insufficient credits' into a plain conflict", async () => {
    const user = await person("Rohan");
    await adjustCredits(support, { userId: String(user._id), amount: 20, reason: "Start", requestKey: "a43-key-0001" });
    vi.mocked(ledger.debitWallet).mockRejectedValueOnce(new PaymentRequiredError("Insufficient credits"));
    const failure = await adjustCredits(support, { userId: String(user._id), amount: -15, reason: "Fix", requestKey: "a43-key-0002" }).catch((error) => error);
    expect(failure).toBeInstanceOf(ConflictError);
    expect(String(failure.message)).toContain("fewer credits than that right now");
    expect(await ledger.walletBalance(String(user._id))).toBe(20);
  });
});
