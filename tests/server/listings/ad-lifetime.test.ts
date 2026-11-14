import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boostFitsBeforeExpiry } from "@/server/billing/boost-window";
import { clampLifetimeHours, lifetimeMs, DEFAULT_AD_LIFETIME_HOURS } from "@/server/listings/lifetime";
import { renewListing } from "@/server/listings/service";
import { listingVisibility } from "@/server/listings/visibility";
import { Listing, Site, User } from "@/server/models";
import { SEED_USER_EMAIL } from "@/server/seed/data";
import { refreshDemoAds } from "@/server/seed/refresh-demo-ads";
import { shardEntries } from "@/lib/seo/sitemaps";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const HOUR = 60 * 60 * 1000;
const req = "req-lifetime";
const previousNoindex = process.env.SITE_NOINDEX;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  if (previousNoindex === undefined) delete process.env.SITE_NOINDEX;
  else process.env.SITE_NOINDEX = previousNoindex;
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  delete process.env.SITE_NOINDEX;
});

async function ownedAd(ownerId: mongoose.Types.ObjectId, expiresAt: Date, status: "active" | "expired" = "active") {
  const doc = await Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    status,
    title: "Used bike",
    description: "A description that is long enough",
    publishedAt: new Date(),
    expiresAt,
    slug: `bike-${Math.random().toString(36).slice(2, 8)}`,
  });
  return String(doc._id);
}

describe("ad lifetime setting", () => {
  it("defaults to 72 hours and clamps the admin value to 1 to 720 hours", () => {
    expect(DEFAULT_AD_LIFETIME_HOURS).toBe(72);
    expect(lifetimeMs(72)).toBe(72 * HOUR);
    expect(clampLifetimeHours(0)).toBe(1);
    expect(clampLifetimeHours(9999)).toBe(720);
    expect(clampLifetimeHours("nonsense")).toBe(72);
    expect(clampLifetimeHours(undefined)).toBe(72);
  });
});

describe("expiry is exact: an ad is live until its expiry and gone at it", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");

  it("is live one millisecond before expiry", () => {
    expect(listingVisibility({ status: "active", expiresAt: new Date(now + 1) }, now)).toBe("live");
  });

  it("is gone (410) at the expiry instant, with no ended page", () => {
    expect(listingVisibility({ status: "active", expiresAt: new Date(now) }, now)).toBe("gone");
    expect(listingVisibility({ status: "expired", expiresAt: new Date(now - 60_000) }, now)).toBe("gone");
  });

  it("a boost never ends after the ad's expiry", () => {
    const expiresAt = new Date(now + 72 * HOUR);
    expect(boostFitsBeforeExpiry(new Date(now + 72 * HOUR), expiresAt)).toBe(true);
    expect(boostFitsBeforeExpiry(new Date(now + 72 * HOUR + 1), expiresAt)).toBe(false);
    expect(boostFitsBeforeExpiry(new Date(now + 1000), null)).toBe(true);
  });
});

describe("renewal follows the admin lifetime", () => {
  it("adds the configured lifetime to the current expiry", async () => {
    const owner = new mongoose.Types.ObjectId();
    const expiresAt = new Date(Date.now() + 10 * HOUR);
    const id = await ownedAd(owner, expiresAt);
    await Site.create({ key: "default", adLifetimeHours: 24, tags: [] });
    const renewed = await renewListing(id, String(owner), req);
    const next = new Date(renewed.expiresAt ?? 0).getTime();
    expect(Math.abs(next - (expiresAt.getTime() + 24 * HOUR))).toBeLessThan(2000);
  });

  it("an expired ad renews from now", async () => {
    const owner = new mongoose.Types.ObjectId();
    const id = await ownedAd(owner, new Date(Date.now() - HOUR), "expired");
    await Site.create({ key: "default", adLifetimeHours: 72, tags: [] });
    const renewed = await renewListing(id, String(owner), req);
    expect(renewed.status).toBe("active");
    expect(new Date(renewed.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 70 * HOUR);
  });
});

describe("sitemap and demo ads", () => {
  it("the sitemap has no ad URLs, even for a live ad", async () => {
    const owner = new mongoose.Types.ObjectId();
    await ownedAd(owner, new Date(Date.now() + 10 * HOUR));
    expect(await shardEntries("ads")).toEqual([]);
  });

  it("refresh demo ads is refused for non-superadmins and off staging", async () => {
    await expect(refreshDemoAds({ actorId: "x", roles: ["admin"], requestId: req })).rejects.toThrow(/superadmin/);
    await expect(refreshDemoAds({ actorId: "x", roles: ["superadmin"], requestId: req })).rejects.toThrow(/staging/);
  });

  it("refresh demo ads renews only the seed user's ads", async () => {
    process.env.SITE_NOINDEX = "true";
    const seed = await User.create({
      email: SEED_USER_EMAIL,
      passwordHash: "seed",
      displayName: "Seed",
      dateOfBirth: new Date("1990-01-15"),
      attestedAdultAt: new Date(),
      emailVerifiedAt: new Date(),
      roles: ["user"],
      verificationStatus: "approved",
      status: "active",
    });
    const demo = await ownedAd(seed._id, new Date(Date.now() - HOUR), "expired");
    const real = await ownedAd(new mongoose.Types.ObjectId(), new Date(Date.now() - HOUR), "expired");
    await Site.create({ key: "default", adLifetimeHours: 72, tags: [] });
    const result = await refreshDemoAds({ actorId: String(new mongoose.Types.ObjectId()), roles: ["superadmin"], requestId: req });
    expect(result.refreshed).toBe(1);
    expect((await Listing.findById(demo))?.status).toBe("active");
    expect((await Listing.findById(real))?.status).toBe("expired");
  });
});
