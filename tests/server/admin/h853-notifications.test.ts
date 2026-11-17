import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bellBadge, dueLabel, timeAgo } from "@/components/admin/notifications/format";
import { kindsForRoles, listNotifications, markAllNotificationsRead, markNotificationRead, unreadNotificationCount } from "@/server/admin/notifications";
import { IdentityVerification, Listing, Payment, Report, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();
const AGO = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const ana = String(oid());
const ben = String(oid());
let listingId = "";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  const member = await User.create({ email: "member@example.test", displayName: "Maya Member", roles: ["user"] });
  const listing = await Listing.create({ ownerId: member._id, categoryId: oid(), title: "Coffee in Pune", description: "A description that is long enough", slug: "coffee-pune", status: "pending", createdAt: AGO(30) });
  listingId = String(listing._id);
  await Report.create({ listingId: listing._id, reason: "spam", severity: "S3", status: "open", createdAt: AGO(20) });
  await Report.create({ listingId: listing._id, reason: "prohibited_content", severity: "S1", status: "open", source: "legal", createdAt: AGO(10) });
  await IdentityVerification.create({ userId: member._id, status: "pending_review", dateOfBirthAsserted: new Date("1990-01-01"), createdAt: AGO(15) });
  await SupportTicket.create({ number: 4001, ownerId: member._id, ownerKind: "user", topic: "my_ads", subject: "Where is my ad", status: "waiting_for_support", lastMessageAt: AGO(5), lastCustomerMessageAt: AGO(5) });
  await Payment.create({ userId: member._id, orderId: oid(), amount: 1500, currency: "INR", status: "pending", idempotencyKey: "h853", provider: "razorpay", method: "crypto", createdAt: AGO(90) });
  await Withdrawal.create({ userId: member._id, coins: 10, coinValueInr: 1, amountInr: 750, method: "upi", status: "requested" });
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

const kindsOf = (page: Awaited<ReturnType<typeof listNotifications>>) => page.items.map((item) => item.kind).sort();

describe("H8.53 which kinds a role sees", () => {
  it("support sees only tickets, finance only payments and payouts, a moderator no legal or money, an admin everything", async () => {
    expect(kindsForRoles(["support"])).toEqual(["ticket"]);
    expect(kindsForRoles(["finance"])).toEqual(["payment", "payout"]);
    expect(kindsForRoles(["moderator"])).toEqual(["ad", "report", "idcheck"]);
    expect(kindsForRoles(["user"])).toEqual([]);

    expect(kindsOf(await listNotifications(ana, ["support"]))).toEqual(["ticket"]);
    expect(kindsOf(await listNotifications(ana, ["finance"]))).toEqual(["payment", "payout"]);
    expect(kindsOf(await listNotifications(ana, ["moderator"]))).toEqual(["ad", "idcheck", "report"]);
    expect(kindsOf(await listNotifications(ana, ["admin"]))).toEqual(["ad", "idcheck", "legal", "payment", "payout", "report", "ticket"]);
  });

  it("each item is one plain line, newest first, with a page to open, and a legal takedown carries its due time", async () => {
    const all = await listNotifications(ana, ["admin"], { pageSize: 50 });
    const times = all.items.map((item) => item.at);
    expect([...times].sort().reverse()).toEqual(times);
    const report = all.items.find((item) => item.kind === "report");
    expect(report).toMatchObject({ text: "New report on 'Coffee in Pune'", href: `/admin/reports/?open=${listingId}` });
    const legal = all.items.find((item) => item.kind === "legal");
    expect(legal?.due).not.toBeNull();
    expect(legal?.href).toMatch(/^\/admin\/reports\/\?tab=legal&open=[0-9a-f]{24}$/);
    expect(all.items.find((item) => item.kind === "ticket")?.href).toMatch(/^\/admin\/support\/\?ticket=[0-9a-f]{24}$/);
    expect(all.items.find((item) => item.kind === "idcheck")?.text).toBe("New ID check from Maya Member");
    expect(all.items.find((item) => item.kind === "ad")?.text).toBe("Ad held for review: 'Coffee in Pune'");
    expect(all.items.find((item) => item.kind === "payout")?.text).toContain("750");
  });

  it("no raw secret or ID document data is carried by an item", async () => {
    const all = await listNotifications(ana, ["admin"], { pageSize: 50 });
    expect(JSON.stringify(all)).not.toMatch(/documentRef|documents|passwordHash|email/i);
  });
});

describe("H8.53 read and unread for each person", () => {
  it("marking one item read changes only that person's list, and a key the role may not see is refused", async () => {
    const before = await listNotifications(ana, ["admin"], { pageSize: 50 });
    expect(before.unread).toBe(7);
    const ticket = before.items.find((item) => item.kind === "ticket");
    expect(await markNotificationRead(ana, ["admin"], ticket?.key ?? "")).toBe(true);
    expect(await unreadNotificationCount(ana, ["admin"])).toBe(6);
    expect(await unreadNotificationCount(ben, ["admin"])).toBe(7);
    expect(await markNotificationRead(ben, ["support"], before.items.find((item) => item.kind === "payout")?.key ?? "")).toBe(false);
    expect(await markNotificationRead(ben, ["admin"], "ticket:not-an-id")).toBe(false);
    const unreadOnly = await listNotifications(ana, ["admin"], { unreadOnly: true, pageSize: 50 });
    expect(unreadOnly.items.some((item) => item.kind === "ticket")).toBe(false);
    expect(unreadOnly.total).toBe(6);
    const reports = await listNotifications(ana, ["admin"], { kind: "report" });
    expect(kindsOf(reports)).toEqual(["report"]);
  });

  it("Mark all as read clears everything so far for that person, and something newer is unread again", async () => {
    await markAllNotificationsRead(ana);
    expect(await unreadNotificationCount(ana, ["admin"])).toBe(0);
    expect(await unreadNotificationCount(ben, ["admin"])).toBe(7);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await Withdrawal.create({ userId: oid(), coins: 5, coinValueInr: 1, amountInr: 5, method: "upi", status: "requested" });
    // The shared list is kept for a few seconds; a new payout shows once it is refreshed, and is unread then.
    const { invalidateTags } = await import("@/lib/cache");
    invalidateTags(["admin-counts"]);
    expect(await unreadNotificationCount(ana, ["admin"])).toBe(1);
  });
});

describe("H8.53 the words on the bell", () => {
  it("shows time ago, due time and the capped number", () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    expect(timeAgo("2026-11-17T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-17T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-17T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-15T12:00:00Z", now)).toBe("2 d ago");
    expect(dueLabel("2026-11-17T15:00:00Z", now)).toBe("Due in 3 h");
    expect(dueLabel("2026-11-17T10:00:00Z", now)).toBe("Overdue by 2 h");
    expect([bellBadge(1), bellBadge(9), bellBadge(10), bellBadge(250)]).toEqual(["1", "9", "9+", "9+"]);
  });
});
