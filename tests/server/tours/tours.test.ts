import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as tourWebhook } from "@/app/api/tours/webhook/route";
import { creditWallet, walletBalance } from "@/server/billing/ledger";
import { accountBalance, trialBalance } from "@/server/ledger";
import { AuditEvent, Category, Listing } from "@/server/models";
import type { CategoryKind } from "@/server/models/catalog";
import {
  TOUR_ACCEPT_WINDOW_MS,
  TOUR_CALL_TIMEOUT_MS,
  TOUR_DISPUTE_WINDOW_MS,
  acceptTour,
  declineTour,
  disputeTour,
  endTour,
  expireDueTours,
  requestTour,
  reverseTour,
  updateVideoTourSettings,
} from "@/server/tours/service";
import { VideoTour } from "@/server/tours/model";
import { signWebhook } from "@/server/wallet";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const req = "req-tours";
const secret = "tour-webhook-secret";
const origin = "http://127.0.0.1:4317";
const uid = () => new mongoose.Types.ObjectId().toString();

let counter = 0;
const key = (prefix: string) => `${prefix}-${(counter += 1)}`;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.PAYMENT_WEBHOOK_SECRET = secret;
  await connectMemoryMongo();
});
afterAll(async () => {
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

/** An active ad, in a category with its tour switch and price set. */
async function ad(opts: { kind?: CategoryKind | null; enabled?: boolean; coins?: number; owner?: string } = {}) {
  const ownerId = opts.owner ? new mongoose.Types.ObjectId(opts.owner) : new mongoose.Types.ObjectId();
  const category = await Category.create({
    slug: key("cat"),
    name: "Cars",
    kind: opts.kind ?? "goods",
    videoTourEnabled: opts.enabled ?? true,
    videoTourCoins: opts.coins ?? 1,
  });
  if (opts.kind === null) await Category.collection.updateOne({ _id: category._id }, { $unset: { kind: "" } });
  const listing = await Listing.create({
    ownerId,
    categoryId: category._id,
    status: "active",
    title: "Used car",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  return { listingId: String(listing._id), categoryId: String(category._id), ownerId: String(ownerId) };
}

async function buyer(coins: number) {
  const id = uid();
  await creditWallet({ userId: id, amount: coins, refType: "test", refId: key("seed"), requestId: req });
  return id;
}

function request(userId: string, listingId: string) {
  return requestTour({ userId, listingId, requestId: req });
}

function signedEvent(payload: unknown, at = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(payload);
  return tourWebhook(
    new Request(`${origin}/api/tours/webhook`, {
      method: "POST",
      headers: { "x-payment-signature": signWebhook(secret, at, raw), "x-payment-timestamp": String(at) },
      body: raw,
    }),
  );
}

describe("live tour requests and the escrow", () => {
  it("moves one coin into escrow on request, and refunds it when the advertiser declines", async () => {
    const a = await ad();
    const user = await buyer(3);
    const tour = await request(user, a.listingId);
    expect(tour.status).toBe("requested");
    expect(await walletBalance(user)).toBe(2);
    expect(await accountBalance("escrow", `booking:${tour.id}`)).toBe(1);

    const declined = await declineTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    expect(declined.status).toBe("declined");
    expect(await walletBalance(user)).toBe(3);
    expect(await trialBalance()).toBe(0);
  });

  it("refuses an advertiser booking their own ad, and a second open request on the same ad", async () => {
    const a = await ad();
    await expect(request(a.ownerId, a.listingId)).rejects.toThrow("Invalid request");
    const user = await buyer(5);
    await request(user, a.listingId);
    await expect(request(user, a.listingId)).rejects.toThrow(/open tour request/);
  });

  it("refuses the request, with a failed tour and no coins taken, when the wallet is short", async () => {
    const a = await ad();
    const user = uid();
    await expect(request(user, a.listingId)).rejects.toThrow();
    expect(await walletBalance(user)).toBe(0);
    expect(await VideoTour.countDocuments({ status: "failed", failureReason: "hold-refused" })).toBe(1);
  });
});

describe("people categories and switches are checked on the server", () => {
  it("refuses a tour of a people listing and takes no coins", async () => {
    const a = await ad({ kind: "people", enabled: false });
    const user = await buyer(2);
    await expect(request(user, a.listingId)).rejects.toThrow(/people listings/);
    expect(await walletBalance(user)).toBe(2);
  });

  it("refuses a tour when the switch is off for the category", async () => {
    const a = await ad({ enabled: false });
    const user = await buyer(2);
    await expect(request(user, a.listingId)).rejects.toThrow(/off/);
    expect(await walletBalance(user)).toBe(2);
  });

  it("only a superadmin can change the settings, and a people category can never be switched on", async () => {
    const a = await ad({ enabled: false });
    await expect(
      updateVideoTourSettings({ actorId: uid(), roles: ["admin"], categoryId: a.categoryId, enabled: true, requestId: req }),
    ).rejects.toThrow(/superadmin/);
    await expect(
      updateVideoTourSettings({ actorId: uid(), roles: ["superadmin"], categoryId: a.categoryId, kind: "people", enabled: true, requestId: req }),
    ).rejects.toThrow("Invalid request");
    const saved = await updateVideoTourSettings({
      actorId: uid(),
      roles: ["superadmin"],
      categoryId: a.categoryId,
      kind: "people",
      requestId: req,
    });
    expect(saved.videoTourEnabled).toBe(false);
    expect(await AuditEvent.countDocuments({ action: "video_tours.settings.update" })).toBe(1);
  });

  it("a category stored with no kind fails closed", async () => {
    const a = await ad({ kind: null });
    const user = await buyer(2);
    await expect(request(user, a.listingId)).rejects.toThrow();
    expect(await walletBalance(user)).toBe(2);
  });
});

describe("accepting, ending and paying out", () => {
  it("a call of two minutes or more pays the advertiser once and sets the 90-day badge", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    const event = { tourId: tour.id, eventId: "end-1", outcome: "ended" as const, durationSeconds: 130, requestId: req };
    await endTour(event);
    await endTour(event);
    await endTour({ ...event, eventId: "end-2" });
    expect(await accountBalance("vendor_earnings", a.ownerId)).toBe(1);
    expect(await walletBalance(user)).toBe(0);
    expect((await VideoTour.findById(tour.id))?.status).toBe("completed");
    const listing = await Listing.findById(a.listingId).lean();
    const days = (new Date(listing?.videoVerifiedUntil ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
    expect(await trialBalance()).toBe(0);
  });

  it("a call shorter than two minutes is refunded and earns no badge", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    await endTour({ tourId: tour.id, eventId: "short", outcome: "ended", durationSeconds: 119, requestId: req });
    expect(await walletBalance(user)).toBe(1);
    expect(await accountBalance("vendor_earnings", a.ownerId)).toBe(0);
    expect((await Listing.findById(a.listingId).lean())?.videoVerifiedUntil).toBeNull();
    expect((await VideoTour.findById(tour.id))?.failureReason).toBe("call-too-short");
  });

  it("a failed call is refunded", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    await endTour({ tourId: tour.id, eventId: "fail", outcome: "failed", requestId: req });
    expect(await walletBalance(user)).toBe(1);
  });

  it("an accept after the 30-minute window refunds the buyer and refuses", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await VideoTour.updateOne({ _id: tour.id }, { $set: { requestedAt: new Date(Date.now() - TOUR_ACCEPT_WINDOW_MS - 1000) } });
    await expect(acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req })).rejects.toThrow(/expired/);
    expect(await walletBalance(user)).toBe(1);
  });

  it("the cron run refunds requests nobody accepted, and accepted tours whose call never ended", async () => {
    const a = await ad();
    const first = await buyer(1);
    const second = await buyer(1);
    const waiting = await request(first, a.listingId);
    await VideoTour.updateOne({ _id: waiting.id }, { $set: { requestedAt: new Date(Date.now() - TOUR_ACCEPT_WINDOW_MS - 1000) } });
    const b = await ad();
    const stuck = await request(second, b.listingId);
    await acceptTour({ ownerId: b.ownerId, tourId: stuck.id, requestId: req });
    await VideoTour.updateOne({ _id: stuck.id }, { $set: { acceptedAt: new Date(Date.now() - TOUR_CALL_TIMEOUT_MS - 1000) } });
    const result = await expireDueTours(req);
    expect(result.toursClosed).toBe(2);
    expect((await VideoTour.findById(waiting.id))?.status).toBe("expired");
    expect((await VideoTour.findById(stuck.id))?.status).toBe("failed");
    expect(await walletBalance(first)).toBe(1);
    expect(await walletBalance(second)).toBe(1);
    expect(await trialBalance()).toBe(0);
  });
});

describe("disputes and reversals", () => {
  async function paidTour(owner?: string) {
    const a = await ad({ owner });
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    await endTour({ tourId: tour.id, eventId: key("end"), outcome: "ended", durationSeconds: 200, requestId: req });
    return { ...a, user, tourId: tour.id };
  }

  it("a buyer disputes within 48 hours, and finance reverses the coin back to the wallet", async () => {
    const t = await paidTour();
    const disputed = await disputeTour({ userId: t.user, tourId: t.tourId, reason: "The car was not shown", requestId: req });
    expect(disputed.status).toBe("disputed");
    const reversed = await reverseTour({ actorId: uid(), roles: ["finance"], tourId: t.tourId, requestId: req });
    expect(reversed.status).toBe("reversed");
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(0);
    expect(await walletBalance(t.user)).toBe(1);
    expect((await Listing.findById(t.listingId).lean())?.videoVerifiedUntil).toBeNull();
    expect(await trialBalance()).toBe(0);
  });

  it("a dispute after the 48-hour window is refused", async () => {
    const t = await paidTour();
    await VideoTour.updateOne({ _id: t.tourId }, { $set: { endedAt: new Date(Date.now() - TOUR_DISPUTE_WINDOW_MS - 1000) } });
    await expect(disputeTour({ userId: t.user, tourId: t.tourId, reason: "Late", requestId: req })).rejects.toThrow(/48-hour/);
  });

  it("a reversal needs a staff role that handles disputes", async () => {
    const t = await paidTour();
    await disputeTour({ userId: t.user, tourId: t.tourId, reason: "Not as shown", requestId: req });
    await expect(reverseTour({ actorId: uid(), roles: ["seo_editor"], tourId: t.tourId, requestId: req })).rejects.toThrow(/does not reverse/);
  });

  it("three reversed disputes switch live tours off for that advertiser", async () => {
    const owner = uid();
    for (let i = 0; i < 3; i += 1) {
      const t = await paidTour(owner);
      await disputeTour({ userId: t.user, tourId: t.tourId, reason: "Not as shown", requestId: req });
      await reverseTour({ actorId: uid(), roles: ["trust_safety"], tourId: t.tourId, requestId: req });
    }
    const next = await ad({ owner });
    const user = await buyer(1);
    await expect(request(user, next.listingId)).rejects.toThrow(/switched off/);
    expect(await walletBalance(user)).toBe(1);
  });
});

describe("the provider webhook", () => {
  it("refuses a bad signature with 400 and an audit row, and credits nothing", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    const raw = JSON.stringify({ tourId: tour.id, eventId: "w1", outcome: "ended", durationSeconds: 500 });
    const response = await tourWebhook(
      new Request(`${origin}/api/tours/webhook`, {
        method: "POST",
        headers: { "x-payment-signature": "nope", "x-payment-timestamp": String(Math.floor(Date.now() / 1000)) },
        body: raw,
      }),
    );
    expect(response.status).toBe(400);
    expect(await AuditEvent.countDocuments({ action: "video_tour.webhook.rejected" })).toBe(1);
    expect((await VideoTour.findById(tour.id))?.status).toBe("accepted");
  });

  it("a signed end event pays once, and a replay changes nothing", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    const payload = { tourId: tour.id, eventId: "w2", outcome: "ended", durationSeconds: 300 };
    expect((await signedEvent(payload)).status).toBe(200);
    expect((await signedEvent(payload)).status).toBe(200);
    expect(await accountBalance("vendor_earnings", a.ownerId)).toBe(1);
  });
});
