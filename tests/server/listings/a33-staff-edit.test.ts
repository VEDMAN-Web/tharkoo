import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));
vi.mock("@/lib/cache", () => ({ refreshPublicCache: async () => undefined }));
vi.mock("@/server/listings/revalidate", () => ({ revalidateListingPages: async () => undefined }));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { getAdHistory, getStaffAd, restoreAdVersion, saveStaffEdit } from "@/server/listings/staff-edit";
import { writeVersion } from "@/server/listings/service";
import { AuditEvent, Category, Listing, ListingVersion, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctx = (roles: string[]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles, requestId: "r" });
const mod = ctx(["moderator"]);

let owner = "";
let adId = "";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  owner = String((await User.create({ email: "seller@example.test", displayName: "Mehul P.", roles: ["user"], status: "active" }))._id);
  const category = await Category.create({
    slug: "property",
    name: "Property",
    enabled: true,
    kind: "property",
    fields: [
      { key: "bedrooms", label: "Bedrooms", type: "number", required: true, order: 1, enabled: true },
      { key: "furnished", label: "Furnished", type: "select", options: ["yes", "semi", "no"], order: 2, enabled: true },
    ],
  });
  const ad = await Listing.create({
    ownerId: owner,
    categoryId: category._id,
    status: "active",
    title: "2 BHK flat near Adajan",
    description: "Spacious flat with lift and parking.",
    price: 20000,
    attributes: { bedrooms: 2, furnished: "semi" },
    slug: "flat-1",
    cityId: new mongoose.Types.ObjectId(),
    contact: { phone: "9876543210" },
  });
  adId = String(ad._id);
  await writeVersion(ad as never, owner);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const values = (changes: Record<string, unknown> = {}) => ({ title: "2 BHK flat near Adajan", description: "Spacious flat with lift and parking.", price: 20000, attributes: { bedrooms: 2, furnished: "semi" }, ...changes });

describe("a staff edit", () => {
  it("keeps a live ad live, writes a new version, and logs it with an undo", async () => {
    const done = await saveStaffEdit(mod, adId, values({ price: 18000, title: "2 BHK flat in Adajan" }));
    expect(done).toMatchObject({ changed: true, title: "2 BHK flat in Adajan" });
    const ad = await Listing.findById(adId).lean();
    expect(ad).toMatchObject({ status: "active", price: 18000, title: "2 BHK flat in Adajan" });
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(2);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "listing.edit", targetId: adId, undo: { kind: "listing.edit" } });
  });

  it("does nothing, and writes no version, when nothing changed", async () => {
    const done = await saveStaffEdit(mod, adId, values());
    expect(done.changed).toBe(false);
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(1);
  });

  it("checks the fields with plain messages and refuses banned words", async () => {
    const bad = async (changes: Record<string, unknown>, field: string) => {
      const error = await saveStaffEdit(mod, adId, values(changes)).catch((caught) => caught);
      expect(error, field).toBeInstanceOf(ValidationError);
      expect(error.fields?.[field]).toBeTruthy();
    };
    await bad({ title: " " }, "title");
    await bad({ title: "x".repeat(71) }, "title");
    await bad({ description: "" }, "description");
    await bad({ price: -5 }, "price");
    await bad({ attributes: { furnished: "semi" } }, "bedrooms");
    await expect(saveStaffEdit(mod, adId, values({ description: "blockedword here" }))).rejects.toThrow();
    expect((await Listing.findById(adId).lean())?.title).toBe("2 BHK flat near Adajan");
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(1);
  });

  it("is for moderators and admins, refuses a removed ad, and logs a refusal", async () => {
    await expect(saveStaffEdit(ctx(["support"]), adId, values({ price: 1 }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
    await Listing.updateOne({ _id: adId }, { $set: { status: "removed" } });
    await expect(saveStaffEdit(mod, adId, values({ price: 1 }))).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("undo and restore", () => {
  it("undo puts the old values back as a new version and the ad stays live", async () => {
    const done = await saveStaffEdit(mod, adId, values({ price: 18000, attributes: { bedrooms: 3, furnished: "yes" } }));
    expect(await undoEvent(mod, done.eventId)).toMatchObject({ ok: true });
    expect(await Listing.findById(adId).lean()).toMatchObject({ status: "active", price: 20000, attributes: { bedrooms: 2, furnished: "semi" } });
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(3);
  });

  it("undo refuses when the ad was edited since, and a role without the right", async () => {
    const first = await saveStaffEdit(mod, adId, values({ price: 18000 }));
    expect(await undoEvent(ctx(["support"]), first.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    await saveStaffEdit(mod, adId, values({ price: 17000 }));
    expect(await undoEvent(mod, first.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    expect((await Listing.findById(adId).lean())?.price).toBe(17000);
  });

  it("restoring an older version makes a new version with those values and nothing is deleted", async () => {
    await saveStaffEdit(mod, adId, values({ price: 18000, title: "Cheaper flat" }));
    const back = await restoreAdVersion(mod, adId, 1);
    expect(back.changed).toBe(true);
    expect(await Listing.findById(adId).lean()).toMatchObject({ status: "active", price: 20000, title: "2 BHK flat near Adajan" });
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(3);
    await expect(restoreAdVersion(mod, adId, 99)).rejects.toThrow("Version not found");
    expect(await AuditEvent.findOne({ action: "listing.edit", summary: /Went back to version 1/ }).lean()).toBeTruthy();
  });
});

describe("the page data", () => {
  it("gives the ad, its fields, the seller and the history with what a restore would change", async () => {
    await saveStaffEdit(mod, adId, values({ price: 18000 }));
    const ad = await getStaffAd(["moderator"], adId);
    expect(ad).toMatchObject({ status: "active", category: "Property", seller: { name: "Mehul P.", liveAds: 1 }, access: { edit: true } });
    expect(ad.fields.map((field) => field.key)).toEqual(["bedrooms", "furnished"]);
    const history = await getAdHistory(["moderator"], adId);
    expect(history.versions.map((entry) => [entry.version, entry.current])).toEqual([["v2", true], ["v1", false]]);
    expect(history.versions[1].changes).toEqual([{ path: "price", kind: "changed", before: "18000", after: "20000" }]);
    expect(history.decisions).toHaveLength(1);
    await expect(getStaffAd(["user"], adId)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getStaffAd(["support"], adId)).access.edit).toBe(false);
  });
});
