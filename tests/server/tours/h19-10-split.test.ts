import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { callBalance } from "@/server/billing/wallets";
import { saveMoneyValues, readMoneySettings } from "@/server/billing/money-settings";
import { accountBalance, trialBalance } from "@/server/ledger";
import { AuditEvent, Category, Listing, Site } from "@/server/models";
import { callEarnInfoFor, callEarningsFor, platformCallRevenue } from "@/server/tours/earnings";
import { raiseLowCallPrices } from "@/server/tours/min-price";
import { loadNotifications } from "@/server/notifications/feed";
import { splitCall } from "@/server/tours/split";
import { VideoTour } from "@/server/tours/model";
import { acceptTour, declineTour, disputeTour, endTour, expireDueTours, requestTour, listTours, reverseTour, updateVideoTourSettings } from "@/server/tours/service";
import { fundCalls, promote } from "../../setup/wallets";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H19.10: the vendor keeps 70 percent of a paid video call and Tharkoo 30 (a money setting). Every amount is checked. */

const req = "req-h1910";
const uid = () => new mongoose.Types.ObjectId().toString();
let counter = 0;

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

async function ad(price: number) {
  const ownerId = new mongoose.Types.ObjectId();
  counter += 1;
  const category = await Category.create({ slug: `cat-h1910-${counter}`, name: "Cars", kind: "goods", videoTourEnabled: true, videoTourCoins: price });
  const listing = await Listing.create({ ownerId, categoryId: category._id, status: "active", title: "Used car", description: "A description that is long enough", publishedAt: new Date() });
  await promote(String(listing._id), String(ownerId));
  return { listingId: String(listing._id), ownerId: String(ownerId), categoryId: String(category._id) };
}

async function setShare(percent: number) {
  await Site.updateOne({ key: "default" }, { $set: { videoCallSharePercent: percent } }, { upsert: true });
}

async function paidCall(price: number, share: number) {
  await setShare(share);
  const a = await ad(price);
  const user = uid();
  await fundCalls(user, price);
  const tour = await requestTour({ userId: user, listingId: a.listingId, requestId: req });
  await acceptTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
  return { ...a, user, tourId: tour.id };
}

const pay = (tourId: string) => endTour({ tourId, eventId: `e-${tourId}`, outcome: "ended", durationSeconds: 0, requestId: req, keepRoom: true });

describe("the split", () => {
  it("rounds the vendor part down and gives Tharkoo the rest", () => {
    expect(splitCall(100, 30)).toEqual({ vendor: 70, fee: 30 });
    expect(splitCall(15, 30)).toEqual({ vendor: 10, fee: 5 });
    expect(splitCall(10, 30)).toEqual({ vendor: 7, fee: 3 });
    expect(splitCall(11, 30)).toEqual({ vendor: 7, fee: 4 });
    expect(splitCall(15, 0)).toEqual({ vendor: 15, fee: 0 });
    expect(splitCall(10, 90)).toEqual({ vendor: 1, fee: 9 });
    for (const price of [10, 11, 15, 99, 250]) {
      for (const pct of [0, 1, 30, 50, 90]) {
        const { vendor, fee } = splitCall(price, pct);
        expect(vendor + fee).toBe(price);
        expect(fee).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("a paid call", () => {
  it("at 30 percent: vendor 70, Tharkoo 30, user pays 100, ledger balanced", async () => {
    const t = await paidCall(100, 30);
    await pay(t.tourId);
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(70);
    expect(await accountBalance("platform_revenue", "system")).toBe(30);
    expect(await callBalance(t.user)).toBe(0);
    expect(await accountBalance("escrow", `booking:${t.tourId}`)).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("at 0 percent: the vendor keeps everything and Tharkoo gets nothing", async () => {
    const t = await paidCall(50, 0);
    await pay(t.tourId);
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(50);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("an odd price of 15 at 30 percent: vendor 10, Tharkoo 5", async () => {
    const t = await paidCall(15, 30);
    await pay(t.tourId);
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(10);
    expect(await accountBalance("platform_revenue", "system")).toBe(5);
    expect(await trialBalance()).toBe(0);
  });

  it("a share changed after the request does not touch the call: the stored share is used", async () => {
    const t = await paidCall(100, 30);
    expect((await VideoTour.findById(t.tourId).lean())?.feePercent).toBe(30);
    await setShare(60);
    await pay(t.tourId);
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(70);
    expect(await accountBalance("platform_revenue", "system")).toBe(30);
    const next = await paidCall(100, 60);
    await pay(next.tourId);
    expect(await accountBalance("vendor_earnings", next.ownerId)).toBe(40);
    expect(await trialBalance()).toBe(0);
  });

  it("is paid once however many times the end arrives", async () => {
    const t = await paidCall(100, 30);
    await pay(t.tourId);
    await pay(t.tourId);
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(70);
    expect(await accountBalance("platform_revenue", "system")).toBe(30);
  });
});

describe("refunds are whole", () => {
  it("a declined request gives all of it back and Tharkoo takes nothing", async () => {
    await setShare(30);
    const a = await ad(100);
    const user = uid();
    await fundCalls(user, 100);
    const tour = await requestTour({ userId: user, listingId: a.listingId, requestId: req });
    await declineTour({ ownerId: a.ownerId, tourId: tour.id, requestId: req });
    expect(await callBalance(user)).toBe(100);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    expect(await accountBalance("vendor_earnings", a.ownerId)).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("a request nobody accepts expires with a full refund", async () => {
    await setShare(30);
    const a = await ad(100);
    const user = uid();
    await fundCalls(user, 100);
    const tour = await requestTour({ userId: user, listingId: a.listingId, requestId: req });
    await VideoTour.updateOne({ _id: tour.id }, { $set: { requestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
    await expireDueTours(req);
    expect(await callBalance(user)).toBe(100);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    expect(await trialBalance()).toBe(0);
  });

  it("a call that ends too short is refunded in full with no fee", async () => {
    const t = await paidCall(100, 30);
    await endTour({ tourId: t.tourId, eventId: "short", outcome: "failed", durationSeconds: 5, requestId: req });
    expect(await callBalance(t.user)).toBe(100);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    expect(await trialBalance()).toBe(0);
  });
});

describe("a reversal puts every credit back", () => {
  it("returns the vendor share and the fee, and the full price goes to the user", async () => {
    const t = await paidCall(100, 30);
    await pay(t.tourId);
    await disputeTour({ userId: t.user, tourId: t.tourId, reason: "The car was not shown", requestId: req });
    await reverseTour({ actorId: uid(), roles: ["finance"], tourId: t.tourId, requestId: req });
    expect(await accountBalance("vendor_earnings", t.ownerId)).toBe(0);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    expect(await callBalance(t.user)).toBe(100);
    expect(await trialBalance()).toBe(0);
  });

  it("works for an odd price and for a call with no fee", async () => {
    const odd = await paidCall(15, 30);
    await pay(odd.tourId);
    await disputeTour({ userId: odd.user, tourId: odd.tourId, reason: "No show", requestId: req });
    await reverseTour({ actorId: uid(), roles: ["finance"], tourId: odd.tourId, requestId: req });
    expect(await callBalance(odd.user)).toBe(15);
    expect(await accountBalance("platform_revenue", "system")).toBe(0);
    const free = await paidCall(40, 0);
    await pay(free.tourId);
    await disputeTour({ userId: free.user, tourId: free.tourId, reason: "No show", requestId: req });
    await reverseTour({ actorId: uid(), roles: ["finance"], tourId: free.tourId, requestId: req });
    expect(await callBalance(free.user)).toBe(40);
    expect(await trialBalance()).toBe(0);
  });
});

describe("the setting and the lowest price", () => {
  it("the share defaults to 30, takes 0 to 90 and is refused outside that", async () => {
    expect((await readMoneySettings()).videoCallSharePercent).toBe(30);
    const ctx = { actorId: uid(), email: "boss@example.test", roles: ["superadmin"], requestId: req };
    expect((await saveMoneyValues(ctx, { videoCallSharePercent: 25 })).settings.videoCallSharePercent).toBe(25);
    expect((await saveMoneyValues(ctx, { videoCallSharePercent: 0 })).settings.videoCallSharePercent).toBe(0);
    expect((await saveMoneyValues(ctx, { videoCallSharePercent: 90 })).settings.videoCallSharePercent).toBe(90);
    await expect(saveMoneyValues(ctx, { videoCallSharePercent: 91 })).rejects.toThrow();
    await expect(saveMoneyValues(ctx, { videoCallSharePercent: -1 })).rejects.toThrow();
  });

  it("a call price under 10 credits is refused; 10 is accepted", async () => {
    const a = await ad(10);
    const roles = ["superadmin"];
    await expect(updateVideoTourSettings({ actorId: uid(), roles, categoryId: a.categoryId, coins: 9, requestId: req })).rejects.toThrow("Invalid request");
    const saved = await updateVideoTourSettings({ actorId: uid(), roles, categoryId: a.categoryId, coins: 10, requestId: req });
    expect(saved.videoTourCoins).toBe(10);
  });
});

describe("what the vendor, the user and the admin see", () => {
  it("the vendor's list shows what they earn and the user's list shows nothing of the split", async () => {
    const t = await paidCall(15, 30);
    const vendorRows = await listTours(t.ownerId);
    const userRows = await listTours(t.user);
    expect(vendorRows[0]).toMatchObject({ role: "advertiser", youEarn: 10, tharkooFee: 5 });
    expect(userRows[0]).toMatchObject({ role: "buyer", coins: 15 });
    expect(JSON.stringify(userRows[0])).not.toMatch(/youEarn|tharkooFee/);
  });

  it("the earnings screen lists a paid call with price, fee and what the vendor got, and totals them", async () => {
    const one = await paidCall(15, 30);
    await pay(one.tourId);
    const earned = await callEarningsFor(one.ownerId);
    expect(earned.total).toBe(10);
    expect(earned.calls[0]).toMatchObject({ price: 15, fee: 5, youGot: 10, title: "Used car" });
  });

  it("the vendor's feed says what they earned from a video call on the ad", async () => {
    const one = await paidCall(100, 30);
    await pay(one.tourId);
    const feed = await loadNotifications(one.ownerId);
    expect(feed.find((item) => item.kind === "calls")?.title).toBe("You earned 70 credits from a video call on Used car");
  });

  it("the vendor line shows the price, what they keep and the rupees", async () => {
    await setShare(30);
    const a = await ad(100);
    const info = await callEarnInfoFor(a.ownerId);
    expect(info.options).toEqual([{ price: 100, youKeep: 70, rupees: 700 }]);
  });

  it("the admin sees Tharkoo's earnings from calls, net of a reversal", async () => {
    const one = await paidCall(100, 30);
    await pay(one.tourId);
    const two = await paidCall(15, 30);
    await pay(two.tourId);
    expect(await platformCallRevenue()).toEqual({ today: 35, week: 35, month: 35 });
    await disputeTour({ userId: one.user, tourId: one.tourId, reason: "No show", requestId: req });
    await reverseTour({ actorId: uid(), roles: ["finance"], tourId: one.tourId, requestId: req });
    expect(await platformCallRevenue()).toEqual({ today: 5, week: 5, month: 5 });
  });

  it("categories under 10 credits are raised to 10 once, and it is logged", async () => {
    await Category.create({ slug: "low-1", name: "Low", kind: "goods", videoTourEnabled: true, videoTourCoins: 3 });
    await Category.create({ slug: "ok-1", name: "Ok", kind: "goods", videoTourEnabled: true, videoTourCoins: 25 });
    const first = await raiseLowCallPrices(req);
    expect(first.raised).toEqual([{ slug: "low-1", was: 3 }]);
    expect((await Category.findOne({ slug: "low-1" }).lean())?.videoTourCoins).toBe(10);
    expect((await Category.findOne({ slug: "ok-1" }).lean())?.videoTourCoins).toBe(25);
    expect((await raiseLowCallPrices(req)).raised).toEqual([]);
    expect(await AuditEvent.countDocuments({ action: "video_tours.min_price.raise" })).toBe(1);
  });

  it("only a superadmin changes the share", async () => {
    const admin = { actorId: uid(), email: "a@example.test", roles: ["admin"], requestId: req };
    await expect(saveMoneyValues(admin, { videoCallSharePercent: 20 })).rejects.toThrow(/superadmin/);
  });
});
