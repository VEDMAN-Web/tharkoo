import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { shownCountsFor } from "@/server/analytics/counts";
import { recordAdEvents, type RecordActor } from "@/server/analytics/record";
import { visitorKeyFor } from "@/server/analytics/visitor";
import { adCountsFor, setAdCounts } from "@/server/listings/ad-counts";
import { AdCounter, AdEvent } from "@/server/models/ad-event";
import { Listing } from "@/server/models";
import { AuditEvent } from "@/server/models/trust";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const owner = new mongoose.Types.ObjectId();
const admin = { id: new mongoose.Types.ObjectId().toHexString(), roles: ["admin"] };
const superadmin = { id: new mongoose.Types.ObjectId().toHexString(), roles: ["superadmin"] };
const moderator = { id: new mongoose.Types.ObjectId().toHexString(), roles: ["moderator"] };

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

async function makeAd(slug: string, status: "active" | "draft" = "active", ownerId = owner) {
  return Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    status,
    title: "Used bike",
    description: "A description that is long enough",
    slug,
    publishedAt: new Date(),
  });
}

function visitor(cookieId: string, extra: Partial<RecordActor> & { userId?: string } = {}): RecordActor {
  const { userId, ...rest } = extra;
  return { visitorKey: visitorKeyFor({ userId, cookieId }), userId, isStaff: false, isBot: false, ...rest };
}

const SLUG = "used-bike-abc123";
const VIEW = [{ slug: SLUG, type: "view" as const }];
const CLICK = [{ slug: SLUG, type: "click" as const }];

describe("H6.17 once per visitor, per ad, ever", () => {
  it("counts a repeat view or click by the same visitor only once", async () => {
    await makeAd(SLUG);
    const first = await recordAdEvents(VIEW, visitor("visitor-cookie-0001"));
    const again = await recordAdEvents(VIEW, visitor("visitor-cookie-0001"));
    const click = await recordAdEvents(CLICK, visitor("visitor-cookie-0001"));
    const clickAgain = await recordAdEvents(CLICK, visitor("visitor-cookie-0001"));
    expect([first.counted, again.counted, click.counted, clickAgain.counted]).toEqual([1, 0, 1, 0]);
    const counter = await AdCounter.findOne().lean();
    expect(counter?.realViews).toBe(1);
    expect(counter?.realClicks).toBe(1);
    expect(await AdEvent.countDocuments()).toBe(2);
  });

  it("counts a visitor once when two requests arrive at the same time", async () => {
    await makeAd(SLUG);
    const actor = visitor("visitor-cookie-0002");
    const [a, b] = await Promise.all([recordAdEvents(VIEW, actor), recordAdEvents(VIEW, actor)]);
    expect(a.counted + b.counted).toBe(1);
    expect((await AdCounter.findOne().lean())?.realViews).toBe(1);
    expect(await AdEvent.countDocuments({ type: "view" })).toBe(1);
  });

  it("counts two different visitors who arrive at the same time as two", async () => {
    await makeAd(SLUG);
    const [a, b] = await Promise.all([recordAdEvents(VIEW, visitor("visitor-cookie-0003")), recordAdEvents(VIEW, visitor("visitor-cookie-0004"))]);
    expect(a.counted + b.counted).toBe(2);
    expect((await AdCounter.findOne().lean())?.realViews).toBe(2);
  });

  it("keys a signed-in person by user id, so the same person on another device is still one visitor", async () => {
    await makeAd(SLUG);
    const userId = new mongoose.Types.ObjectId().toHexString();
    const phone = visitor("cookie-phone-000001", { userId });
    const laptop = visitor("cookie-laptop-00001", { userId });
    expect(phone.visitorKey).toBe(laptop.visitorKey);
    const [a, b] = await Promise.all([recordAdEvents(VIEW, phone), recordAdEvents(VIEW, laptop)]);
    expect(a.counted + b.counted).toBe(1);
  });

  it("stores only a hashed visitor key, never the cookie or the user id", async () => {
    await makeAd(SLUG);
    await recordAdEvents(VIEW, visitor("visitor-cookie-0005"));
    const row = await AdEvent.findOne().lean();
    expect(row?.visitorKey).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.visitorKey).not.toContain("visitor-cookie-0005");
    expect(Object.keys(row ?? {}).sort()).toEqual(["_id", "createdAt", "listingId", "type", "visitorKey", "__v"].sort());
  });
});

describe("H6.17 what is not counted", () => {
  it("does not count bots, staff, the owner, drafts or preview pages", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    await makeAd(SLUG, "active", ownerId);
    await makeAd("draft-bike-abc999", "draft");
    expect((await recordAdEvents(VIEW, visitor("visitor-cookie-0010", { isBot: true }))).counted).toBe(0);
    expect((await recordAdEvents(VIEW, visitor("visitor-cookie-0011", { isStaff: true }))).counted).toBe(0);
    expect((await recordAdEvents(VIEW, visitor("owner-cookie-000012", { userId: String(ownerId) }))).counted).toBe(0);
    expect((await recordAdEvents([{ slug: "draft-bike-abc999", type: "view" }], visitor("visitor-cookie-0013"))).counted).toBe(0);
    expect((await recordAdEvents([{ slug: "preview", type: "view" }], visitor("visitor-cookie-0014"))).counted).toBe(0);
    expect(await AdEvent.countDocuments()).toBe(0);
    expect(await AdCounter.countDocuments()).toBe(0);
  });
});

describe("H6.17 admin sets the shown numbers", () => {
  it("shows the set number, then adds every new unique visitor on top; real counts stay as they are", async () => {
    const ad = await makeAd(SLUG);
    for (const cookie of ["visitor-cookie-0020", "visitor-cookie-0021", "visitor-cookie-0022", "visitor-cookie-0023", "visitor-cookie-0024"]) {
      await recordAdEvents(VIEW, visitor(cookie));
    }
    await recordAdEvents(CLICK, visitor("visitor-cookie-0020"));
    expect(await shownCountsFor([SLUG])).toEqual({ [SLUG]: { views: 5, clicks: 1 } });

    await setAdCounts({ listingId: String(ad._id), views: 1000, clicks: 40, actor: admin, requestId: "req-set-1" });
    expect(await shownCountsFor([SLUG])).toEqual({ [SLUG]: { views: 1000, clicks: 40 } });

    // Visitors counted before the change are not counted again; new ones add on top.
    await recordAdEvents(VIEW, visitor("visitor-cookie-0020"));
    await recordAdEvents(VIEW, visitor("visitor-cookie-0030"));
    await recordAdEvents(VIEW, visitor("visitor-cookie-0031"));
    await recordAdEvents(CLICK, visitor("visitor-cookie-0030"));
    expect(await shownCountsFor([SLUG])).toEqual({ [SLUG]: { views: 1002, clicks: 41 } });
    const after = await adCountsFor(String(ad._id));
    expect(after.real).toEqual({ views: 7, clicks: 2 });
    expect(after.set).toEqual({ views: 1000, clicks: 40 });
  });

  it("an admin edit does not change the real counts or the ad itself", async () => {
    const ad = await makeAd(SLUG);
    await recordAdEvents(VIEW, visitor("visitor-cookie-0040"));
    const realBefore = (await AdCounter.findOne().lean())?.realViews;
    const adBefore = await Listing.findById(ad._id).lean();

    await setAdCounts({ listingId: String(ad._id), views: 0, clicks: 0, actor: superadmin, requestId: "req-set-2" });

    expect((await AdCounter.findOne().lean())?.realViews).toBe(realBefore);
    expect(await Listing.findById(ad._id).lean()).toEqual(adBefore);
    expect((await adCountsFor(String(ad._id))).shown).toEqual({ views: 0, clicks: 0 });
  });

  it("writes an audit row with the old and new values", async () => {
    const ad = await makeAd(SLUG);
    await setAdCounts({ listingId: String(ad._id), views: 500, clicks: 9, actor: admin, requestId: "req-audit" });
    const row = await AuditEvent.findOne({ action: "ad.counts.update" }).lean();
    expect(row?.targetId).toBe(String(ad._id));
    expect(row?.before).toMatchObject({ shown: { views: 0, clicks: 0 } });
    expect(row?.after).toMatchObject({ shown: { views: 500, clicks: 9 }, set: { views: 500, clicks: 9 } });
  });

  it("refuses moderators, and rejects values that are not whole numbers of 0 or more", async () => {
    const ad = await makeAd(SLUG);
    await expect(setAdCounts({ listingId: String(ad._id), views: 5, clicks: 5, actor: moderator, requestId: "r" })).rejects.toThrow(/Only an admin/);
    await expect(setAdCounts({ listingId: String(ad._id), views: -1, clicks: 0, actor: admin, requestId: "r" })).rejects.toThrow();
    await expect(setAdCounts({ listingId: String(ad._id), views: 1.5, clicks: 0, actor: admin, requestId: "r" })).rejects.toThrow();
    expect(await AdCounter.countDocuments({ viewsSet: { $gt: 0 } })).toBe(0);
  });
});
