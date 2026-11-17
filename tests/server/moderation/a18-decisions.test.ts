import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { FEE_REF, isPostingFeePaid } from "@/server/billing/posting-fee";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { rejectListing, removeLiveAd } from "@/server/moderation/decide";
import { AuditEvent, Listing, User, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const mod = { email: "mod@example.test", roles: ["moderator"] };
const ctx = (roles = ["moderator"]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: mod.email, roles, requestId: "r" });
const FEE = 30;

let owner = "";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  const user = await User.create({ email: "seller@example.test", displayName: "Seller", roles: ["user"], status: "active" });
  owner = String(user._id);
  await User.create({ email: mod.email, displayName: "Mod", passwordHash: "x", roles: ["moderator"], status: "active", dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date() });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

async function ad(status: "pending" | "active", paid: boolean) {
  const row = await Listing.create({ ownerId: owner, status, categoryId: new mongoose.Types.ObjectId(), title: "Used cycle", description: "A well kept cycle for sale" });
  const id = String(row._id);
  if (paid) await debitWallet({ userId: owner, amount: FEE, refType: FEE_REF, refId: `${id}:0`, requestId: "fee", once: true });
  return id;
}

async function fund(amount = 100) {
  await creditWallet({ userId: owner, amount, refType: "seed", refId: `seed-${Math.random()}`, requestId: "seed" });
}

describe("reject and remove with the credits choice", () => {
  it("rejects a paid pending ad and gives the fee back only when asked", async () => {
    await fund();
    const giveBack = await ad("pending", true);
    const keep = await ad("pending", true);
    expect(await walletBalance(owner)).toBe(40);
    expect(await rejectListing({ id: giveBack, ...mod, reason: "Photos do not match", refund: true })).toMatchObject({ status: "rejected", refunded: FEE });
    expect(await walletBalance(owner)).toBe(70);
    expect(await rejectListing({ id: keep, ...mod, reason: "Photos do not match", refund: false })).toMatchObject({ status: "rejected", refunded: 0 });
    expect(await walletBalance(owner)).toBe(70);
    expect(await isPostingFeePaid(giveBack)).toBe(false);
    expect(await isPostingFeePaid(keep)).toBe(true);
  });

  it("gives nothing back for a free ad even when asked", async () => {
    await fund();
    const id = await ad("pending", false);
    expect(await rejectListing({ id, ...mod, reason: "No", refund: true })).toMatchObject({ refunded: 0 });
    expect(await walletBalance(owner)).toBe(100);
    expect(await WalletEntry.countDocuments({ refType: "listing_fee_refund" })).toBe(0);
  });

  it("removes a live ad with a reason, keeps the old default of giving the fee back for older callers, and refuses ads that are not live", async () => {
    await fund();
    const id = await ad("active", true);
    await expect(removeLiveAd({ id, ...mod, reason: "  ", refund: false })).rejects.toBeInstanceOf(ValidationError);
    const done = await removeLiveAd({ id, ...mod, reason: "Spam", refund: true });
    expect(done).toMatchObject({ status: "removed", refunded: FEE });
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
    await expect(removeLiveAd({ id, ...mod, reason: "Spam", refund: true })).rejects.toBeInstanceOf(ConflictError);
    const pending = await ad("pending", true);
    expect(await rejectListing({ id: pending, ...mod, reason: "No" })).toMatchObject({ refunded: FEE });
  });

  it("refuses a role that cannot decide", async () => {
    const id = await ad("active", false);
    await expect(removeLiveAd({ id, email: "x@example.test", roles: ["support"], reason: "Spam", refund: false })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
  });

  it("audits the decision with its reason and an undo window", async () => {
    const id = await ad("active", false);
    const done = await removeLiveAd({ id, ...mod, reason: "Spam", refund: false });
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "listing.remove", targetId: id, reason: "Spam" });
    expect(row?.after).toMatchObject({ status: "removed", refundedCredits: 0 });
    expect(row?.undo?.kind).toBe("listing.decision");
  });
});

describe("undo of a decision", () => {
  it("brings a removed ad back live and takes the given back credits back while unspent, never charging a new fee", async () => {
    await fund();
    const id = await ad("active", true);
    const done = await removeLiveAd({ id, ...mod, reason: "Spam", refund: true });
    expect(await walletBalance(owner)).toBe(100);
    const result = await undoEvent(ctx(), done.eventId);
    expect(result.ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    expect(await walletBalance(owner)).toBe(70);
    expect(await isPostingFeePaid(id)).toBe(true);
    const undoRow = await AuditEvent.findById((result as { eventId: string }).eventId).lean();
    expect(undoRow?.summary).toContain(`took back ${FEE} credits`);
    expect(await undoEvent(ctx(), done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("restores the ad but keeps the credits with the seller when they were already spent", async () => {
    await fund(30);
    const id = await ad("pending", true);
    const done = await rejectListing({ id, ...mod, reason: "No", refund: true });
    expect(await walletBalance(owner)).toBe(30);
    await debitWallet({ userId: owner, amount: 30, refType: "spend", refId: "spent-all", requestId: "s" });
    const result = await undoEvent(ctx(), done.eventId);
    expect(result.ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("pending");
    expect(await walletBalance(owner)).toBe(0);
    const undoRow = await AuditEvent.findById((result as { eventId: string }).eventId).lean();
    expect(undoRow?.summary).toContain("credits already spent, not taken back");
  });

  it("undo without a refund restores the ad with no money moving, and the undo can be undone", async () => {
    await fund();
    const id = await ad("active", true);
    const done = await removeLiveAd({ id, ...mod, reason: "Spam", refund: false });
    const undone = await undoEvent(ctx(), done.eventId);
    expect(undone.ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("active");
    expect(await walletBalance(owner)).toBe(70);
    const redone = await undoEvent(ctx(), (undone as { eventId: string }).eventId);
    expect(redone.ok).toBe(true);
    expect((await Listing.findById(id).lean())?.status).toBe("removed");
  });

  it("refuses an undo when the ad changed since, and for a role that cannot decide", async () => {
    const id = await ad("active", false);
    const done = await removeLiveAd({ id, ...mod, reason: "Spam", refund: false });
    expect(await undoEvent(ctx(["support"]), done.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    await Listing.updateOne({ _id: id }, { $set: { status: "paused" } });
    expect(await undoEvent(ctx(), done.eventId)).toMatchObject({ ok: false, reason: "conflict" });
  });
});
