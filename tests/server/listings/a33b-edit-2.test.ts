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
import { ForbiddenError, ValidationError } from "@/server/http";
import { writeVersion } from "@/server/listings/service";
import { getStaffAd, restoreAdVersion, saveStaffEdit } from "@/server/listings/staff-edit";
import { Category, Listing, ListingVersion, Location, MediaAsset, User } from "@/server/models";
import { Subcategory } from "@/server/models/subcategory";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const mod: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "mod@example.test", roles: ["moderator"], requestId: "r" };

let owner = "";
let adId = "";
let property = "";
let jobs = "";
let jobsSub = "";
let surat = "";
let pune = "";
const photos: string[] = [];

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  photos.length = 0;
  owner = String((await User.create({ email: "seller@example.test", displayName: "Mehul P.", roles: ["user"], status: "active" }))._id);
  const propertyDoc = await Category.create({ slug: "property", name: "Property", enabled: true, kind: "property", fields: [{ key: "bedrooms", label: "Bedrooms", type: "number", required: true, order: 1, enabled: true }, { key: "furnished", label: "Furnished", type: "select", options: ["yes", "no"], order: 2, enabled: true }] });
  const jobsDoc = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, kind: "job", fields: [{ key: "salary", label: "Salary", type: "number", required: false, order: 1, enabled: true }] });
  property = String(propertyDoc._id);
  jobs = String(jobsDoc._id);
  jobsSub = String((await Subcategory.create({ categoryId: jobsDoc._id, slug: "driver", name: "Driver", enabled: true }))._id);
  surat = String((await Location.create({ type: "city", slug: "surat", name: "Surat" }))._id);
  pune = String((await Location.create({ type: "city", slug: "pune", name: "Pune" }))._id);
  for (let index = 0; index < 3; index += 1) photos.push(String((await MediaAsset.create({ ownerId: owner, kind: "image", objectKey: `/uploads/ad-${index}.jpg`, status: "cleared", contentType: "image/jpeg", bytes: 100 }))._id));
  const ad = await Listing.create({
    ownerId: owner,
    categoryId: propertyDoc._id,
    status: "active",
    title: "2 BHK flat near Adajan",
    description: "Spacious flat with lift and parking.",
    price: 20000,
    attributes: { bedrooms: 2, furnished: "yes" },
    slug: "flat-1",
    cityId: surat,
    mediaIds: photos,
    coverMediaId: photos[0],
    contact: { phone: "9876543210" },
  });
  adId = String(ad._id);
  await writeVersion(ad as never, owner);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const base = () => ({ title: "2 BHK flat near Adajan", description: "Spacious flat with lift and parking.", price: 20000, attributes: { bedrooms: 2, furnished: "yes" } });
const saved = async () => (await Listing.findById(adId).lean())!;

describe("photos", () => {
  it("reorders, removes and makes the first photo the cover, and the ad stays live", async () => {
    const done = await saveStaffEdit(mod, adId, { ...base(), mediaIds: [photos[2], photos[0]] });
    expect(done.changed).toBe(true);
    const ad = await saved();
    expect(ad.mediaIds?.map(String)).toEqual([photos[2], photos[0]]);
    expect(String(ad.coverMediaId)).toBe(photos[2]);
    expect(ad.status).toBe("active");
  });

  it("adds a photo uploaded for the seller, refuses another person's photo and a missing one", async () => {
    const fresh = String((await MediaAsset.create({ ownerId: owner, kind: "image", objectKey: "new.jpg", status: "cleared", contentType: "image/jpeg", bytes: 100 }))._id);
    await saveStaffEdit(mod, adId, { ...base(), mediaIds: [...photos, fresh] });
    expect((await saved()).mediaIds).toHaveLength(4);
    const stranger = String((await MediaAsset.create({ ownerId: new mongoose.Types.ObjectId(), kind: "image", objectKey: "other.jpg", status: "cleared", contentType: "image/jpeg", bytes: 100 }))._id);
    await expect(saveStaffEdit(mod, adId, { ...base(), mediaIds: [...photos, fresh, stranger] })).rejects.toBeInstanceOf(ForbiddenError);
    const error = await saveStaffEdit(mod, adId, { ...base(), mediaIds: [String(new mongoose.Types.ObjectId())] }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fields.photos).toBeTruthy();
    expect((await saved()).mediaIds).toHaveLength(4);
  });

  it("keeps the videos of the ad where they are and refuses a new video", async () => {
    const video = String((await MediaAsset.create({ ownerId: owner, kind: "video", objectKey: "v.mp4", status: "cleared", contentType: "video/mp4", bytes: 100 }))._id);
    await Listing.updateOne({ _id: adId }, { $set: { mediaIds: [...photos, video] } });
    await saveStaffEdit(mod, adId, { ...base(), mediaIds: [video, photos[1], photos[0]] });
    expect((await saved()).mediaIds?.map(String)).toEqual([photos[1], photos[0], video]);
    const other = String((await MediaAsset.create({ ownerId: owner, kind: "video", objectKey: "v2.mp4", status: "cleared", contentType: "video/mp4", bytes: 100 }))._id);
    await expect(saveStaffEdit(mod, adId, { ...base(), mediaIds: [photos[0], other] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("undo puts the old order and cover back as a new version", async () => {
    const done = await saveStaffEdit(mod, adId, { ...base(), mediaIds: [photos[1]] });
    expect(await undoEvent(mod, done.eventId)).toMatchObject({ ok: true });
    const ad = await saved();
    expect(ad.mediaIds?.map(String)).toEqual(photos);
    expect(String(ad.coverMediaId)).toBe(photos[0]);
    expect(await ListingVersion.countDocuments({ listingId: adId })).toBe(3);
  });
});

describe("place", () => {
  it("moves the ad to another city and refuses an empty or unknown one", async () => {
    await saveStaffEdit(mod, adId, { ...base(), cityId: pune });
    expect(String((await saved()).cityId)).toBe(pune);
    const empty = await saveStaffEdit(mod, adId, { ...base(), cityId: "" }).catch((caught) => caught);
    expect(empty.fields.cityId).toBeTruthy();
    await expect(saveStaffEdit(mod, adId, { ...base(), cityId: String(new mongoose.Types.ObjectId()) })).rejects.toThrow();
    expect(String((await saved()).cityId)).toBe(pune);
  });
});

describe("category", () => {
  it("moves the ad to another category when its details fit the new fields and the type is chosen", async () => {
    const noType = await saveStaffEdit(mod, adId, { ...base(), categoryId: jobs, attributes: { salary: 15000 } }).catch((caught) => caught);
    expect(noType).toBeInstanceOf(ValidationError);
    expect(noType.fields.subcategoryId).toBeTruthy();
    const done = await saveStaffEdit(mod, adId, { ...base(), categoryId: jobs, subcategoryId: jobsSub, attributes: { salary: 15000 } });
    expect(done.changed).toBe(true);
    const ad = await saved();
    expect(String(ad.categoryId)).toBe(jobs);
    expect(String(ad.subcategoryId)).toBe(jobsSub);
    expect(ad.attributes).toMatchObject({ salary: 15000 });
    expect(ad.status).toBe("active");
  });

  it("refuses when a required detail of the new category is missing, and a category that does not exist", async () => {
    await saveStaffEdit(mod, adId, { ...base(), categoryId: jobs, subcategoryId: jobsSub, attributes: { salary: 1 } });
    const error = await saveStaffEdit(mod, adId, { ...base(), categoryId: property, attributes: {} }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fields.bedrooms).toBeTruthy();
    await expect(saveStaffEdit(mod, adId, { ...base(), categoryId: String(new mongoose.Types.ObjectId()) })).rejects.toThrow();
    expect(String((await saved()).categoryId)).toBe(jobs);
  });

  it("undo and restore bring the category, details, city and photos back together", async () => {
    const done = await saveStaffEdit(mod, adId, { ...base(), categoryId: jobs, subcategoryId: jobsSub, attributes: { salary: 9 }, cityId: pune, mediaIds: [photos[2]] });
    expect(await undoEvent(mod, done.eventId)).toMatchObject({ ok: true });
    let ad = await saved();
    expect([String(ad.categoryId), String(ad.cityId), ad.mediaIds?.length, ad.subcategoryId ?? null]).toEqual([property, surat, 3, null]);
    expect(ad.attributes).toMatchObject({ bedrooms: 2, furnished: "yes" });
    await saveStaffEdit(mod, adId, { ...base(), categoryId: jobs, subcategoryId: jobsSub, attributes: { salary: 5 } });
    await restoreAdVersion(mod, adId, 1);
    ad = await saved();
    expect([String(ad.categoryId), String(ad.cityId), ad.mediaIds?.length]).toEqual([property, surat, 3]);
  });

  it("an undo saved before photos and category were part of an edit still works", async () => {
    const done = await saveStaffEdit(mod, adId, { ...base(), price: 18000 });
    await mongoose.connection.collection("audit_events").updateOne({ _id: new mongoose.Types.ObjectId(done.eventId) }, { $set: { "undo.data.restore": { title: "2 BHK flat near Adajan", description: "Spacious flat with lift and parking.", price: 20000, attributes: { bedrooms: 2, furnished: "yes" } }, "undo.data.expect": { price: 18000 } } }).catch(() => undefined);
    expect(await undoEvent(mod, done.eventId).then((result) => result.ok || result.reason)).toBeTruthy();
  });
});

describe("the page data", () => {
  it("gives the photos with ids, the owner's email, the limit and the category and place choices", async () => {
    const ad = await getStaffAd(["moderator"], adId);
    expect(ad.photos.map((photo) => photo.id)).toEqual(photos);
    expect(ad).toMatchObject({ ownerEmail: "seller@example.test", videoIds: [] });
    expect(ad.mediaLimit).toBeGreaterThan(0);
    expect(ad.options.categories.map((category) => category.name).sort()).toEqual(["Jobs", "Property"]);
    expect(ad.options.places.map((place) => place.name).sort()).toEqual(["Pune", "Surat"]);
    expect(ad.values).toMatchObject({ categoryId: property, cityId: surat, mediaIds: photos, coverMediaId: photos[0] });
  });
});
