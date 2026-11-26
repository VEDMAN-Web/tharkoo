import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { callBalance } from "@/server/billing/wallets";
import { accountBalance, trialBalance } from "@/server/ledger";
import { Category, Listing, Site } from "@/server/models";
import { VideoTour } from "@/server/tours/model";
import { setVideoRoomProvider } from "@/server/tours/room";
import {
  TOUR_CALL_TIMEOUT_MS,
  acceptTour,
  cancelTour,
  expireDueTours,
  listTours,
  requestTour,
  settleConnectedTours,
  tourStats,
} from "@/server/tours/service";
import { fundCalls, promote } from "../../setup/wallets";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const req = "req-queue";
const uid = () => new mongoose.Types.ObjectId().toString();
const MINUTE = 60_000;

let counter = 0;
const key = (prefix: string) => `${prefix}-${(counter += 1)}`;

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
  await Site.updateOne({ key: "default" }, { $set: { videoCallSharePercent: 0 } }, { upsert: true });
});
afterEach(() => setVideoRoomProvider(null));

/** An active ad with video calls on. Several ads can share one owner (the line is per advertiser). */
async function ad(owner?: string) {
  const ownerId = owner ? new mongoose.Types.ObjectId(owner) : new mongoose.Types.ObjectId();
  const category = await Category.create({ slug: key("cat"), name: "Cars", kind: "goods", videoTourEnabled: true, videoTourCoins: 1 });
  const listing = await Listing.create({
    ownerId,
    categoryId: category._id,
    status: "active",
    title: "Used car",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  await promote(String(listing._id), String(ownerId));
  return { listingId: String(listing._id), ownerId: String(ownerId) };
}

async function buyer(coins = 3) {
  const id = uid();
  await fundCalls(id, coins);
  return id;
}

const request = (userId: string, listingId: string) => requestTour({ userId, listingId, requestId: req });

/** A fake video service: real-looking rooms, and a count of people in each that the test controls. */
function rooms(inRoom: Record<string, number> = {}) {
  const deleted: string[] = [];
  setVideoRoomProvider({
    name: "mock",
    createRoom: async ({ tourId }) => ({ roomId: `room_${tourId}`, live: false }),
    joinUrlFor: async () => null,
    deleteRoom: async (roomId) => void deleted.push(roomId),
    participantCount: async (roomId) => inRoom[roomId] ?? 0,
  });
  return { deleted, inRoom };
}

describe("the buyer cancels", () => {
  it("takes a waiting request back and gets the credit at once", async () => {
    const a = await ad();
    const user = await buyer(2);
    const tour = await request(user, a.listingId);
    expect(await callBalance(user)).toBe(1);
    const cancelled = await cancelTour({ userId: user, tourId: tour.id, requestId: req });
    expect(cancelled.status).toBe("cancelled");
    expect(await callBalance(user)).toBe(2);
    expect(await trialBalance()).toBe(0);
    await expect(cancelTour({ userId: user, tourId: tour.id, requestId: req })).rejects.toThrow(/no longer be cancelled/);
    // The slot is free again: the same buyer can ask for this ad once more.
    await expect(request(user, a.listingId)).resolves.toMatchObject({ status: "requested" });
  });

  it("only the buyer of that call can cancel it", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await expect(cancelTour({ userId: uid(), tourId: tour.id, requestId: req })).rejects.toThrow("Not found");
    await expect(cancelTour({ userId: a.ownerId, tourId: tour.id, requestId: req })).rejects.toThrow("Not found");
    expect((await VideoTour.findById(tour.id))?.status).toBe("requested");
  });

  it("lets go of an accepted call nobody joined, deletes the room, and cannot cancel once both connected", async () => {
    const fake = rooms();
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    const cancelled = await cancelTour({ userId: user, tourId: tour.id, requestId: req });
    expect(cancelled.status).toBe("cancelled");
    expect(await callBalance(user)).toBe(1);
    expect(fake.deleted).toEqual([`room_${tour.id}`]);

    const second = await buyer(1);
    const other = await ad();
    const connected = await request(second, other.listingId);
    await acceptTour({ ownerId: other.ownerId, tourId: connected.id, requestId: req });
    fake.inRoom[`room_${connected.id}`] = 2;
    await settleConnectedTours(req);
    await expect(cancelTour({ userId: second, tourId: connected.id, requestId: req })).rejects.toThrow(/no longer be cancelled/);
    expect(await accountBalance("vendor_earnings", other.ownerId)).toBe(1);
  });
});

describe("the line", () => {
  it("tells each buyer how many are ahead of them for the same advertiser", async () => {
    const first = await ad();
    const second = await ad(first.ownerId);
    const third = await ad(first.ownerId);
    const [u1, u2, u3] = [await buyer(1), await buyer(1), await buyer(1)];
    await request(u1, first.listingId);
    await request(u2, second.listingId);
    await request(u3, third.listingId);
    const ahead = async (user: string) => (await listTours(user))[0]?.ahead;
    expect(await ahead(u1)).toBe(0);
    expect(await ahead(u2)).toBe(1);
    expect(await ahead(u3)).toBe(2);
    // The advertiser sees all three, and nobody is in a call yet.
    const mine = await listTours(first.ownerId);
    expect(mine).toHaveLength(3);
    expect(mine.every((row) => row.busy === false)).toBe(true);
  });

  it("does not count a request that already ran out of time", async () => {
    const first = await ad();
    const second = await ad(first.ownerId);
    const [u1, u2] = [await buyer(1), await buyer(1)];
    const old = await request(u1, first.listingId);
    await request(u2, second.listingId);
    await VideoTour.updateOne({ _id: old.id }, { $set: { requestedAt: new Date(Date.now() - 31 * MINUTE) } });
    expect((await listTours(u2))[0]?.ahead).toBe(0);
  });
});

describe("an advertiser on a call", () => {
  it("is shown as busy, and cannot accept the next request until the call ends", async () => {
    const fake = rooms();
    const first = await ad();
    const next = await ad(first.ownerId);
    const [u1, u2] = [await buyer(1), await buyer(1)];
    const t1 = await request(u1, first.listingId);
    const t2 = await request(u2, next.listingId);
    await acceptTour({ ownerId: first.ownerId, tourId: t1.id, requestId: req });
    fake.inRoom[`room_${t1.id}`] = 2;
    const waiting = (await listTours(u2)).find((row) => row.id === t2.id);
    expect(waiting?.busy).toBe(true);
    await expect(acceptTour({ ownerId: first.ownerId, tourId: t2.id, requestId: req })).rejects.toThrow(/another video call/);
    expect((await VideoTour.findById(t2.id))?.status).toBe("requested");
  });

  it("is not busy while only one person is in the room", async () => {
    const fake = rooms();
    const first = await ad();
    const next = await ad(first.ownerId);
    const [u1, u2] = [await buyer(1), await buyer(1)];
    const t1 = await request(u1, first.listingId);
    const t2 = await request(u2, next.listingId);
    await acceptTour({ ownerId: first.ownerId, tourId: t1.id, requestId: req });
    fake.inRoom[`room_${t1.id}`] = 1;
    await expect(acceptTour({ ownerId: first.ownerId, tourId: t2.id, requestId: req })).resolves.toMatchObject({ status: "accepted" });
  });
});

describe("refunds no longer wait for the nightly run", () => {
  it("refunds a request nobody answered in 30 minutes when the buyer looks at their calls", async () => {
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await VideoTour.updateOne({ _id: tour.id }, { $set: { requestedAt: new Date(Date.now() - 31 * MINUTE) } });
    const rows = await listTours(user);
    expect(rows[0]).toMatchObject({ status: "expired", failureReason: "not-accepted" });
    expect(await callBalance(user)).toBe(1);
    expect((await expireDueTours(req)).toursClosed).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("closes an accepted call nobody joined once its room has run out, and gives the credit back", async () => {
    rooms();
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    expect(TOUR_CALL_TIMEOUT_MS).toBe(45 * MINUTE);
    await VideoTour.updateOne({ _id: tour.id }, { $set: { acceptedAt: new Date(Date.now() - 46 * MINUTE) } });
    const rows = await listTours(a.ownerId);
    expect(rows[0]).toMatchObject({ status: "failed", failureReason: "call-not-ended" });
    expect(await callBalance(user)).toBe(1);
    // The buyer is free to ask again straight away.
    await expect(request(user, a.listingId)).resolves.toMatchObject({ status: "requested" });
  });

  it("leaves a recent accepted call alone", async () => {
    rooms();
    const a = await ad();
    const user = await buyer(1);
    const tour = await request(user, a.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    await VideoTour.updateOne({ _id: tour.id }, { $set: { acceptedAt: new Date(Date.now() - 20 * MINUTE) } });
    expect((await listTours(user))[0]?.status).toBe("accepted");
  });
});

describe("the numbers on the video calls page", () => {
  it("counts each side from the database", async () => {
    rooms();
    const a = await ad();
    const b = await ad(a.ownerId);
    const c = await ad(a.ownerId);
    const [u1, u2, u3] = [await buyer(1), await buyer(1), await buyer(1)];
    const t1 = await request(u1, a.listingId);
    const t2 = await request(u2, b.listingId);
    const t3 = await request(u3, c.listingId);
    await acceptTour({ ownerId: a.ownerId, tourId: t1.id, requestId: req });
    await cancelTour({ userId: u2, tourId: t2.id, requestId: req });
    expect(t3.status).toBe("requested");
    const vendor = await tourStats(a.ownerId);
    expect(vendor.advertiser).toEqual({ total: 3, waiting: 1, accepted: 1, declined: 0, missed: 1, completed: 0 });
    expect(vendor.buyer.total).toBe(0);
    const person = await tourStats(u1);
    expect(person.buyer).toEqual({ total: 1, waiting: 0, accepted: 1, declined: 0, missed: 0, completed: 0 });
    expect(person.advertiser.total).toBe(0);
    expect(await tourStats(uid())).toEqual({
      advertiser: { total: 0, waiting: 0, accepted: 0, declined: 0, missed: 0, completed: 0 },
      buyer: { total: 0, waiting: 0, accepted: 0, declined: 0, missed: 0, completed: 0 },
    });
  });
});
