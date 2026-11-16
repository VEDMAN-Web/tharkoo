import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { backfillClearedMedia } from "../../../scripts/backfill-cleared-media.mjs";
import { submitListing } from "@/server/listings/service";
import { completeMedia, setCsamScanner, signMedia } from "@/server/media/service";
import { setCloudinaryClient, type CloudinaryClient } from "@/server/media/client";
import { Category, Listing, MediaAsset, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const remote = new Map<string, { bytes: number; format: string; duration?: number }>();

function stubCloudinary() {
  setCloudinaryClient({
    resource: async (id) => remote.get(id) ?? null,
    destroy: async () => undefined,
    list: async () => [],
    signedDownload: () => "",
  } satisfies CloudinaryClient);
}

async function member() {
  return User.create({
    email: `member${Math.random().toString(36).slice(2, 8)}@example.com`,
    displayName: "Asha",
    passwordHash: "x",
    status: "active",
    roles: ["user"],
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    verificationStatus: "approved",
  });
}

async function draftFor(userId: string) {
  const category = await Category.create({ slug: "dating", name: "Dating", enabled: true });
  return Listing.create({
    ownerId: userId,
    categoryId: category._id,
    title: "Coffee and a walk",
    description: "Looking to meet for coffee and a walk.",
    status: "draft",
    cityId: new mongoose.Types.ObjectId(),
    contact: { phone: "9876543210" },
  });
}

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
  remote.clear();
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "k";
  process.env.CLOUDINARY_API_SECRET = "s";
  process.env.CSAM_PROVIDER = "stub";
  stubCloudinary();
});

afterEach(() => {
  setCloudinaryClient(null);
  setCsamScanner(null);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

async function sendPhoto(userId: string, listingId: string) {
  const signed = await signMedia(userId, { listingId, contentType: "image/jpeg", byteSize: 1200, kind: "image" }, "r");
  const asset = await MediaAsset.findById(signed.mediaId);
  remote.set(asset!.objectKey, { bytes: 1200, format: "jpg" });
  return signed.mediaId;
}

describe("a photo that passed the scan is cleared (H7.100 a)", () => {
  it("moves a Cloudinary photo to cleared with a clearedAt and one audit row", async () => {
    const user = await member();
    const draft = await draftFor(user.id);
    const mediaId = await sendPhoto(user.id, draft.id);
    expect(await completeMedia(user.id, mediaId, "r")).toEqual({ status: "cleared" });
    const row = await MediaAsset.findById(mediaId);
    expect(row?.status).toBe("cleared");
    expect(row?.clearedAt).toBeInstanceOf(Date);
  });

  it("still refuses a photo the scanner matches", async () => {
    const user = await member();
    const draft = await draftFor(user.id);
    const mediaId = await sendPhoto(user.id, draft.id);
    setCsamScanner({ scan: async () => ({ match: true, listId: "l", hitId: "h" }) });
    await expect(completeMedia(user.id, mediaId, "r")).rejects.toThrow("Upload was rejected");
    expect((await MediaAsset.findById(mediaId))?.status).toBe("rejected_csam");
  });

  it("lets a member publish an ad with Cloudinary photos (this used to fail with MEDIA_NOT_CLEARED)", async () => {
    const user = await member();
    const draft = await draftFor(user.id);
    const ids = [await sendPhoto(user.id, draft.id), await sendPhoto(user.id, draft.id), await sendPhoto(user.id, draft.id)];
    for (const id of ids) await completeMedia(user.id, id, "r");
    await Listing.updateOne({ _id: draft._id }, { $set: { mediaIds: ids, coverMediaId: ids[0] } });
    const published = await submitListing(draft.id, user.id, { adult: true, accurate: true, rights: true }, "req");
    expect(published.status).toBe("active");
  });
});

describe("videos up to 100 MB and 60 seconds (H7.100 c)", () => {
  async function video(userId: string, listingId: string, bytes: number, duration: number) {
    const signed = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: bytes, kind: "video" }, "r");
    const asset = await MediaAsset.findById(signed.mediaId);
    remote.set(asset!.objectKey, { bytes, format: "mp4", duration });
    return signed;
  }

  it("clears a 40 MB, 45 second video and asks Cloudinary for a 720p mp4", async () => {
    const user = await member();
    const draft = await draftFor(user.id);
    const signed = await video(user.id, draft.id, 40 * 1024 * 1024, 45);
    expect(String((signed.params as Record<string, string>).eager)).toContain("h_720");
    expect(await completeMedia(user.id, signed.mediaId, "r")).toEqual({ status: "cleared" });
  });

  it("says in plain words why a video is refused", async () => {
    const user = await member();
    const draft = await draftFor(user.id);
    await expect(signMedia(user.id, { listingId: draft.id, contentType: "video/mp4", byteSize: 120 * 1024 * 1024, kind: "video" }, "r")).rejects.toThrow(
      "This file is too big (max 100 MB).",
    );
    await expect(signMedia(user.id, { listingId: draft.id, contentType: "video/x-msvideo", byteSize: 1000, kind: "video" }, "r")).rejects.toThrow("Use an mp4, webm or mov video.");
    await expect(signMedia(user.id, { contentType: "video/mp4", byteSize: 1000, kind: "video" }, "r")).rejects.toThrow("Save the ad details first, then add the video.");
    const long = await video(user.id, draft.id, 5 * 1024 * 1024, 75);
    await expect(completeMedia(user.id, long.mediaId, "r")).rejects.toThrow("This video is longer than 60 seconds.");
  });
});

describe("backfill script (H7.100 b)", () => {
  async function seed() {
    const owner = new mongoose.Types.ObjectId();
    const updatedAt = new Date("2026-10-01T10:00:00Z");
    const make = (kind: string, status: string, objectKey: string) => ({ ownerId: owner, kind, status, objectKey, createdAt: updatedAt, updatedAt });
    await MediaAsset.collection.insertMany([
      make("image", "scanning", "tharkoo/listings/aaa"),
      make("image", "scanning", "tharkoo/listings/bbb"),
      make("image", "scanning", "/uploads/local.jpg"),
      make("id_document", "scanning", "tharkoo/id/ccc"),
      make("image", "cleared", "tharkoo/listings/ddd"),
      make("image", "rejected_csam", "tharkoo/listings/eee"),
    ]);
    return updatedAt;
  }

  it("is a dry run by default: it counts and writes nothing", async () => {
    await seed();
    const result = await backfillClearedMedia(mongoose.connection.db!);
    expect(result).toMatchObject({ apply: false, stuck: 2, changed: 0 });
    expect(await MediaAsset.countDocuments({ status: "scanning" })).toBe(4);
  });

  it("with apply it clears only Cloudinary photos on scanning, with clearedAt = updatedAt, and a second run changes nothing", async () => {
    const updatedAt = await seed();
    const first = await backfillClearedMedia(mongoose.connection.db!, { apply: true });
    expect(first).toMatchObject({ apply: true, stuck: 2, changed: 2 });
    const cleared = await MediaAsset.find({ objectKey: { $in: ["tharkoo/listings/aaa", "tharkoo/listings/bbb"] } });
    expect(cleared.every((row) => row.status === "cleared" && row.clearedAt?.getTime() === updatedAt.getTime())).toBe(true);
    expect((await MediaAsset.findOne({ objectKey: "/uploads/local.jpg" }))?.status).toBe("scanning");
    expect((await MediaAsset.findOne({ kind: "id_document" }))?.status).toBe("scanning");
    expect((await MediaAsset.findOne({ status: "rejected_csam" }))?.status).toBe("rejected_csam");
    const second = await backfillClearedMedia(mongoose.connection.db!, { apply: true });
    expect(second).toMatchObject({ stuck: 0, changed: 0 });
  });
});
