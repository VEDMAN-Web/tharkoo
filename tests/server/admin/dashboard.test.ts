import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDashboardData } from "@/server/admin/dashboard";
import { AuditEvent, Category, IdentityVerification, Listing, Location, PromotionOrder, Report, User, type ListingStatus } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 15:30 on 15 June in India. */
const NOW = new Date("2026-06-15T10:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

async function user(email: string, createdAt: Date) {
  return User.create({
    email,
    passwordHash: "hash",
    displayName: "Test",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: createdAt,
    createdAt,
  });
}

async function fixture() {
  const [catA, catB] = await Category.create([
    { slug: "cat-a", name: "Category A" },
    { slug: "cat-b", name: "Category B" },
  ]);
  const [cityX, cityY] = await Location.create([
    { type: "city", slug: "city-x", name: "City X" },
    { type: "city", slug: "city-y", name: "City Y" },
  ]);
  const owner = await user("owner@example.test", ago(40 * DAY));
  await user("new-a@example.test", ago(HOUR));
  await user("new-b@example.test", ago(3 * DAY));
  await user("old@example.test", ago(20 * DAY));

  const ad = (status: ListingStatus, categoryId: mongoose.Types.ObjectId, cityId: mongoose.Types.ObjectId, createdAt: Date, slug?: string) => ({
    ownerId: owner._id,
    status,
    categoryId,
    cityId,
    title: "Ad",
    description: "A plain description",
    createdAt,
    ...(slug ? { slug } : {}),
  });
  const listings = await Listing.create([
    ad("active", catA._id, cityX._id, ago(HOUR)),
    ad("active", catA._id, cityX._id, ago(2 * HOUR)),
    ad("pending", catB._id, cityX._id, ago(HOUR)),
    ad("draft", catB._id, cityX._id, ago(HOUR)),
    ad("deleted", catB._id, cityX._id, ago(HOUR)),
    ad("active", catA._id, cityY._id, ago(3 * DAY)),
    ad("active", catB._id, cityY._id, ago(20 * DAY), "demo-0001"),
    ad("active", catA._id, cityX._id, ago(40 * DAY)),
  ]);

  const dob = new Date("1995-04-02");
  await IdentityVerification.create([
    { userId: owner._id, status: "pending_review", dateOfBirthAsserted: dob },
    { userId: owner._id, status: "pending_review", dateOfBirthAsserted: dob },
    { userId: owner._id, status: "approved", dateOfBirthAsserted: dob },
  ]);
  const report = (status: "open" | "dismissed") => ({ listingId: listings[0]._id, reason: "spam" as const, severity: "S3" as const, status });
  await Report.create([report("open"), report("open"), report("dismissed")]);

  const order = (status: "active" | "pending", endsAt?: Date) => ({
    userId: owner._id,
    listingId: listings[0]._id,
    productId: new mongoose.Types.ObjectId(),
    durationDays: 7,
    status,
    endsAt,
  });
  await PromotionOrder.create([
    order("active", new Date(NOW.getTime() + DAY)),
    order("active", ago(DAY)),
    order("pending", new Date(NOW.getTime() + DAY)),
  ]);

  const reveal = (createdAt: Date) => ({
    actorType: "user" as const,
    action: "listing.contact_reveal",
    targetType: "listing",
    targetId: String(listings[0]._id),
    requestId: "req",
    createdAt,
  });
  await AuditEvent.create([reveal(ago(HOUR)), reveal(ago(2 * DAY)), reveal(ago(30 * DAY))]);
}

describe("getDashboardData", () => {
  it("returns the same numbers as direct database counts on a fixture", async () => {
    await fixture();
    const data = await getDashboardData(NOW);

    expect(data.kpis.liveAds).toBe(await Listing.countDocuments({ status: "active" }));
    expect(data.kpis.pendingModeration).toBe(await Listing.countDocuments({ status: "pending" }));
    expect(data.kpis.openReports).toBe(await Report.countDocuments({ status: "open" }));
    expect(data.kpis.idChecksWaiting).toBe(await IdentityVerification.countDocuments({ status: "pending_review" }));

    expect(data.kpis).toEqual({
      liveAds: 5,
      pendingModeration: 1,
      newAdsToday: 3,
      newAds7d: 4,
      newUsers7d: 2,
      idChecksWaiting: 2,
      openReports: 2,
      contactReveals7d: 2,
      promotionsActive: 1,
    });
  });

  it("lists ads by category and city, biggest first, with names", async () => {
    await fixture();
    const data = await getDashboardData(NOW);
    expect(data.adsByCategory).toEqual([
      { label: "Category A", value: 4 },
      { label: "Category B", value: 1 },
    ]);
    expect(data.adsByCity).toEqual([
      { label: "City X", value: 3 },
      { label: "City Y", value: 2 },
    ]);
  });

  it("gives 30 days of new ads in Indian time and counts demo listings", async () => {
    await fixture();
    const data = await getDashboardData(NOW);
    expect(data.newAdsPerDay).toHaveLength(30);
    expect(data.newAdsPerDay.at(-1)).toEqual({ date: "2026-06-15", count: 3 });
    expect(data.newAdsPerDay.find((day) => day.date === "2026-06-12")?.count).toBe(1);
    expect(data.newAdsPerDay.find((day) => day.date === "2026-05-26")?.count).toBe(1);
    expect(data.newAdsPerDay.reduce((total, day) => total + day.count, 0)).toBe(5);
    expect(data.demoListings).toBe(1);
  });

  it("puts a late-evening ad on the next Indian day", async () => {
    await fixture();
    await Listing.create({
      ownerId: new mongoose.Types.ObjectId(),
      status: "active",
      categoryId: new mongoose.Types.ObjectId(),
      title: "Late",
      description: "Late ad",
      createdAt: new Date("2026-06-14T19:00:00.000Z"),
    });
    const data = await getDashboardData(NOW);
    expect(data.newAdsPerDay.at(-1)?.count).toBe(4);
  });

  it("shows nothing instead of invented numbers when the database is empty", async () => {
    const data = await getDashboardData(NOW);
    expect(data.kpis.contactReveals7d).toBeNull();
    expect(data.kpis.liveAds).toBe(0);
    expect(data.adsByCategory).toEqual([]);
    expect(data.adsByCity).toEqual([]);
    expect(data.demoListings).toBe(0);
    expect(data.newAdsPerDay).toHaveLength(30);
    expect(data.newAdsPerDay.every((day) => day.count === 0)).toBe(true);
  });
});
