import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allWaiting, countLabel, sumCounts } from "@/lib/admin/count-sum";
import { forbiddenHtml, forbiddenInfo } from "@/lib/admin/forbidden";
import { roleWords } from "@/lib/admin/role-words";
import { COUNT_IDS, countsForRoles, getAdminCounts } from "@/server/admin/counts";
import { IdentityVerification, Listing, MediaAsset, Payment, Report, Site, User } from "@/server/models";
import { ContentItem } from "@/server/models/content";
import { SupportTicket } from "@/server/models/support";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const oid = () => new mongoose.Types.ObjectId();
const AGO = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function ad(ownerId: mongoose.Types.ObjectId, slug: string, extra: Record<string, unknown> = {}) {
  return Listing.create({ ownerId, categoryId: oid(), title: `Ad ${slug}`, description: "A description that is long enough", slug, status: "active", publishedAt: new Date(), ...extra });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  const seed = await User.create({ email: SEED_USER_EMAIL, displayName: "Seed", passwordHash: "x", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
  const real = await User.create({ email: "real@example.test", displayName: "Real", roles: ["user"] });
  await Site.create({ key: "main", postModerationSince: AGO(60 * 24) });

  await ad(seed._id, "demo-0001", { status: "pending" });
  await ad(seed._id, "demo-0002", { publishedAt: AGO(60) });
  await ad(real._id, "held-one", { status: "pending" });
  await ad(real._id, "held-two", { status: "pending" });
  await ad(real._id, "live-new", { publishedAt: AGO(60) });
  await ad(real._id, "live-checked", { publishedAt: AGO(60), lastModerationAt: new Date() });
  await ad(real._id, "live-old", { publishedAt: AGO(60 * 72) });
  const waiting = await ad(real._id, "live-photo", { publishedAt: AGO(60 * 72), lastModerationAt: new Date() });
  await MediaAsset.create({ ownerId: real._id, listingId: waiting._id, kind: "image", objectKey: "/uploads/a.jpg", status: "scanning" });

  await Report.create({ listingId: oid(), reason: "spam", severity: "S3", status: "open" });
  await Report.create({ listingId: oid(), reason: "spam", severity: "S3", status: "ack" });
  await Report.create({ listingId: oid(), reason: "spam", severity: "S3", status: "dismissed" });
  await Report.create({ listingId: oid(), reason: "prohibited_content", severity: "S1", status: "open", source: "legal" });
  await IdentityVerification.create({ userId: real._id, status: "pending_review", dateOfBirthAsserted: new Date("1990-01-01") });
  await IdentityVerification.create({ userId: oid(), status: "approved", dateOfBirthAsserted: new Date("1990-01-01") });
  for (const status of ["waiting_for_support", "open", "closed"] as const) {
    await SupportTicket.create({ number: Math.floor(Math.random() * 1e6), ownerId: real._id, ownerKind: "user", topic: "my_ads", subject: "Help", status, lastMessageAt: new Date(), lastCustomerMessageAt: new Date() });
  }
  const pay = { userId: real._id, orderId: oid(), amount: 100, currency: "INR", status: "pending" as const };
  await Payment.create({ ...pay, idempotencyKey: "a", provider: "razorpay", method: "crypto", createdAt: AGO(45) });
  await Payment.create({ ...pay, idempotencyKey: "b", provider: "razorpay", method: "crypto", createdAt: AGO(5) });
  await Payment.create({ ...pay, idempotencyKey: "c", provider: "mock", method: "card", createdAt: AGO(60) });
  await Withdrawal.create({ userId: real._id, coins: 10, coinValueInr: 1, amountInr: 10, method: "upi", status: "requested" });
  await Withdrawal.create({ userId: real._id, coins: 10, coinValueInr: 1, amountInr: 10, method: "upi", status: "paid" });
  await ContentItem.create({ kind: "blog", slug: "waiting", status: "review" });
  await ContentItem.create({ kind: "blog", slug: "fine", status: "published" });
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("which counters a role may see (A7)", () => {
  it("lists the ten counters and gives each role only its own", () => {
    expect(COUNT_IDS).toHaveLength(10);
    expect(countsForRoles(["admin"])).toEqual(COUNT_IDS);
    expect(countsForRoles(["superadmin"])).toEqual(COUNT_IDS);
    expect(countsForRoles(["moderator"])).toEqual(["reviewLive", "reviewHeld", "reviewEdited", "reports", "idChecks"]);
    expect(countsForRoles(["trust_safety"])).toEqual(["reviewLive", "reviewHeld", "reviewEdited", "reports", "legal", "idChecks"]);
    expect(countsForRoles(["support"])).toEqual(["tickets"]);
    expect(countsForRoles(["finance"])).toEqual(["recharges", "payouts"]);
    expect(countsForRoles(["seo_editor"])).toEqual(["contentReview"]);
    expect(countsForRoles(["blog_editor"])).toEqual(["contentReview"]);
    expect(countsForRoles(["user"])).toEqual([]);
    expect(countsForRoles([])).toEqual([]);
    expect(countsForRoles(undefined)).toEqual([]);
  });
});

describe("the counts (A7)", () => {
  it("counts real work only: demo ads, closed items, test payments and checked ads are left out", async () => {
    const all = await getAdminCounts(["admin"]);
    expect(all).toEqual({
      reviewLive: 1,
      reviewHeld: 2,
      reviewEdited: 1,
      reports: 2,
      legal: 1,
      idChecks: 1,
      tickets: 2,
      recharges: 1,
      payouts: 1,
      contentReview: 1,
    });
  });

  it("each role gets only the numbers it may see", async () => {
    expect(await getAdminCounts(["support"])).toEqual({ tickets: 2 });
    expect(await getAdminCounts(["finance"])).toEqual({ recharges: 1, payouts: 1 });
    expect(await getAdminCounts(["blog_editor"])).toEqual({ contentReview: 1 });
    expect(await getAdminCounts(["moderator"])).toEqual({ reviewLive: 1, reviewHeld: 2, reviewEdited: 1, reports: 2, idChecks: 1 });
    expect(await getAdminCounts(["user"])).toEqual({});
  });

  it("shows no live-not-checked ads before an admin sets the cut-over date", async () => {
    await Site.updateOne({ key: "main" }, { $set: { postModerationSince: null } });
    const trust = await getAdminCounts(["trust_safety"]);
    expect(trust.reviewLive).toBe(0);
    expect(trust.reviewHeld).toBe(2);
    expect(trust.legal).toBe(1);
  });
});

describe("count helpers (A7)", () => {
  it("sums only the counters present and says null when there are none", () => {
    expect(sumCounts({ reviewLive: 1, reviewHeld: 2 }, ["reviewLive", "reviewHeld", "reviewEdited"])).toBe(3);
    expect(sumCounts({}, ["tickets"])).toBeNull();
    expect(sumCounts({ tickets: 0 }, ["tickets"])).toBe(0);
    expect(allWaiting({ tickets: 2, reports: 3 })).toBe(5);
    expect(countLabel(7)).toBe("7");
    expect(countLabel(250)).toBe("99+");
  });
});

describe("the 403 page (A7)", () => {
  it("has one H1, is noindex, names the screen and who can open it, and leads back to the Dashboard", () => {
    const html = forbiddenHtml("/admin/prices/");
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain("You cannot open Prices &amp; plans");
    expect(html).toContain("Your staff role does not open this screen.");
    expect(html).toContain('<a href="/admin/">Back to Dashboard</a>');
    expect(forbiddenInfo("/admin/prices/").who).toBe("Admin, Superadmin, Finance");
  });

  it("names superadmin alone for Settings, and admins for a screen the map does not list", () => {
    expect(forbiddenInfo("/admin/settings/")).toEqual({ screen: "Settings", who: "Superadmin" });
    expect(forbiddenInfo("/admin/not-listed/")).toEqual({ screen: "this screen", who: "Admin, Superadmin" });
    expect(forbiddenHtml("/admin/<script>/")).not.toContain("<script>");
  });

  it("writes role names in plain words", () => {
    expect(roleWords(["trust_safety", "blog_editor"])).toBe("Trust and safety, Blog editor");
    expect(roleWords([])).toBe("Staff");
  });
});
