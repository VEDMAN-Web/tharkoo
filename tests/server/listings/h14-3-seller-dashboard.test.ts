import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanGoal, defaultGoal, goalProgress, istDayKey, istWeekStart, lastDays, liftOf, niceNumberUp, percentChange } from "@/server/listings/dashboard-math";
import { saveWeeklyGoal, sellerDashboard } from "@/server/listings/seller-dashboard";
import { AdCounter, AdEvent } from "@/server/models/ad-event";
import { Listing, PromotionOrder, PromotionProduct, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const NOW = new Date("2026-11-18T10:00:00Z");
const at = (day: number, hour: number, month = 11) => new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+05:30`);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await Promise.all([AdEvent.init(), AdCounter.init()]);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

let counter = 0;
async function events(listingId: mongoose.Types.ObjectId, type: "view" | "click", when: Date, count: number) {
  const rows = Array.from({ length: count }, () => ({ listingId, type, visitorKey: `visitor-${(counter += 1)}`, createdAt: new Date(when.getTime() + counter * 1000) }));
  if (rows.length) await AdEvent.collection.insertMany(rows);
}

async function seed() {
  const user = await User.create({ email: "seller@example.test", displayName: "Ajay", roles: ["user"], verificationStatus: "unsubmitted", status: "active" });
  const other = await User.create({ email: "other@example.test", displayName: "Other", roles: ["user"], verificationStatus: "unsubmitted", status: "active" });
  const published = new Date("2026-10-01T05:00:00Z");
  const ad = await Listing.create({ ownerId: user._id, categoryId: new mongoose.Types.ObjectId(), status: "active", title: "Toyota Innova", description: "A description that is long enough", slug: "toyota-innova-aaa111", publishedAt: published, expiresAt: new Date("2026-11-20T05:00:00Z") });
  const review = await Listing.create({ ownerId: user._id, categoryId: new mongoose.Types.ObjectId(), status: "pending", title: "Flat for rent", description: "A description that is long enough", slug: "flat-for-rent-bbb222" });
  await Listing.create({ ownerId: user._id, categoryId: new mongoose.Types.ObjectId(), status: "draft", title: "Draft ad", description: "A description that is long enough", slug: "draft-ad-ccc333" });
  const foreign = await Listing.create({ ownerId: other._id, categoryId: new mongoose.Types.ObjectId(), status: "active", title: "Not mine", description: "A description that is long enough", slug: "not-mine-ddd444", publishedAt: published });
  // The week before (Thu 5 to Wed 11 November): 6 views, 1 click.
  await events(ad._id, "view", at(8, 11), 3);
  await events(ad._id, "view", at(9, 11), 3);
  await events(ad._id, "click", at(9, 11), 1);
  // Last 7 days. Two views fall just after midnight in India, which is the evening before in UTC.
  await events(ad._id, "view", new Date("2026-11-11T18:40:00Z"), 1);
  await events(ad._id, "view", at(12, 11), 4);
  await events(ad._id, "view", new Date("2026-11-12T18:45:00Z"), 1);
  await events(ad._id, "view", at(13, 11), 2);
  await events(ad._id, "click", at(13, 11), 1);
  await events(ad._id, "view", at(15, 11), 25);
  await events(ad._id, "view", at(16, 11), 15);
  await events(ad._id, "view", at(17, 11), 10);
  await events(ad._id, "click", at(17, 11), 3);
  await events(ad._id, "view", at(18, 11), 5);
  await events(foreign._id, "view", at(17, 11), 50);
  const top = await PromotionProduct.create({ code: "top", name: "TOP", description: "TOP", amount: 100, currency: "INR", durationDays: 2, enabled: true });
  await PromotionOrder.create({ userId: user._id, listingId: ad._id, productId: top._id, status: "active", durationDays: 2, startsAt: at(15, 0), endsAt: at(17, 0) });
  return { user, other, ad, review, foreign };
}

describe("H14.3 D1: the numbers on the dashboard", () => {
  it("counts views and clicks for the last 7 days and the 7 before, in India days, for this seller only", async () => {
    const { user } = await seed();
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.hasAds).toBe(true);
    expect(data.views.total).toBe(63);
    expect(data.views.previous).toBe(6);
    expect(data.views.percent).toBe(950);
    expect(data.clicks.total).toBe(4);
    expect(data.clicks.previous).toBe(1);
    expect(data.clicks.percent).toBe(300);
    expect(data.days.map((day) => day.label)).toEqual(["Thu 12", "Fri 13", "Sat 14", "Sun 15", "Mon 16", "Tue 17", "Wed 18"]);
    expect(data.days.map((day) => day.views)).toEqual([5, 3, 0, 25, 15, 10, 5]);
    expect(data.days.map((day) => day.clicks)).toEqual([0, 1, 0, 0, 0, 3, 0]);
    expect(data.views.spark).toEqual([5, 3, 0, 25, 15, 10, 5]);
  });

  it("shades the days a TOP boost was running", async () => {
    const { user } = await seed();
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.days.map((day) => day.topOn)).toEqual([false, false, false, true, true, false, false]);
  });

  it("counts the ads by state", async () => {
    const { user } = await seed();
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.counts).toEqual({ live: 1, endsSoon: 1, review: 1, drafts: 1, all: 3 });
    expect(data.ads.map((ad) => [ad.title, ad.status, ad.views])).toEqual([
      ["Toyota Innova", "live", 63],
      ["Flat for rent", "review", 0],
    ]);
  });

  it("shows a TOP lift only from real numbers: views a day during, before and since", async () => {
    const { user } = await seed();
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.lift).toMatchObject({ adTitle: "Toyota Innova", times: 10, during: 20, before: 2, endedDaysAgo: 1 });
    expect(data.ads[0].trend).toEqual({ kind: "boost", times: 10 });
  });

  it("shows no lift when the boost brought no extra views, or when there were none before it", () => {
    const endsAt = new Date("2026-11-17T00:00:00+05:30");
    const base = { duringMs: 2 * 86_400_000, sinceViews: 3, endsAt, now: NOW };
    expect(liftOf({ ...base, duringViews: 10, beforeViews: 70 })).toBeNull();
    expect(liftOf({ ...base, duringViews: 40, beforeViews: 0 })).toBeNull();
    expect(liftOf({ ...base, duringViews: 40, beforeViews: 14 })?.times).toBe(10);
  });

  it("has no lift card numbers for an ad that was too new when the boost began", async () => {
    const { user, ad } = await seed();
    await Listing.updateOne({ _id: ad._id }, { $set: { publishedAt: at(10, 9) } });
    expect((await sellerDashboard(String(user._id), NOW)).lift).toBeNull();
  });

  it("starts the goal at last week's views x 1.2 rounded up to a nice number, at least 100, and keeps a saved goal", async () => {
    const { user } = await seed();
    const first = await sellerDashboard(String(user._id), NOW);
    expect(first.goal).toMatchObject({ goal: 100, views: 30, remaining: 70, percent: 30, daysLeft: 5, isDefault: true });
    await saveWeeklyGoal(String(user._id), 500);
    expect((await sellerDashboard(String(user._id), NOW)).goal).toMatchObject({ goal: 500, isDefault: false, remaining: 470, percent: 6 });
  });

  it("marks milestones done from the all-time real counters", async () => {
    const { user, ad } = await seed();
    await AdCounter.create({ listingId: ad._id, realViews: 1200, realClicks: 40 });
    const data = await sellerDashboard(String(user._id), NOW);
    expect(data.milestones.map((item) => [item.key, item.done, item.so])).toEqual([
      ["views100", true, 1200],
      ["views1000", true, 1200],
      ["clicks100", false, 40],
      ["views5000", false, 1200],
    ]);
  });

  it("says there are no ads for a user with none", async () => {
    const user = await User.create({ email: "buyer@example.test", displayName: "Buyer", roles: ["user"], verificationStatus: "unsubmitted", status: "active" });
    expect((await sellerDashboard(String(user._id), NOW)).hasAds).toBe(false);
  });
});

describe("H14.3 D2: the numbers an admin sets for display never reach the dashboard", () => {
  it("ignores viewsSet and clicksSet", async () => {
    const { user, ad } = await seed();
    const before = await sellerDashboard(String(user._id), NOW);
    await AdCounter.create({ listingId: ad._id, realViews: 120, realClicks: 4, viewsSet: 987654, viewsRealAtSet: 0, clicksSet: 123456, clicksRealAtSet: 0 });
    const after = await sellerDashboard(String(user._id), NOW);
    expect(after.views).toEqual(before.views);
    expect(after.clicks).toEqual(before.clicks);
    expect(after.ads[0].views).toBe(63);
    expect(after.milestones.find((item) => item.key === "views100")?.so).toBe(120);
    expect(JSON.stringify(after)).not.toContain("987654");
    expect(JSON.stringify(after)).not.toContain("123456");
  });
});

describe("H14.3 the helpers", () => {
  it("cuts days at midnight in India", () => {
    expect(istDayKey(new Date("2026-11-11T18:40:00Z"))).toBe("2026-11-12");
    expect(istDayKey(new Date("2026-11-11T18:20:00Z"))).toBe("2026-11-11");
    expect(lastDays(NOW, 3).map((day) => day.key)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
  });

  it("starts the week on Monday in India", () => {
    expect(istWeekStart(NOW).toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(istWeekStart(new Date("2026-11-22T17:00:00Z")).toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(istWeekStart(new Date("2026-11-22T19:00:00Z")).toISOString()).toBe("2026-11-22T18:30:00.000Z");
  });

  it("changes in percent and nothing to compare with", () => {
    expect(percentChange(797, 311)).toBe(156);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(3, 6)).toBe(-50);
  });

  it("rounds goals to nice numbers and checks what a person typed", () => {
    expect(niceNumberUp(43.2)).toBe(50);
    expect(niceNumberUp(373)).toBe(400);
    expect(niceNumberUp(1001)).toBe(1500);
    expect(defaultGoal(0)).toBe(100);
    expect(defaultGoal(311)).toBe(400);
    expect(defaultGoal(5_000_000)).toBe(1_000_000);
    expect(cleanGoal("1,000")).toBe(1000);
    expect(cleanGoal(49)).toBeNull();
    expect(cleanGoal(1_000_001)).toBeNull();
    expect(cleanGoal("12.5")).toBeNull();
    expect(cleanGoal("abc")).toBeNull();
    expect(goalProgress({ saved: 40, weekViews: 10, lastWeekViews: 100, now: NOW }).goal).toBe(150);
  });
});
