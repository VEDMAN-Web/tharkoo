import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PolicyViolationError } from "@/server/http";
import { saveLocalMedia, signMedia } from "@/server/media/service";
import { STAFF_PEOPLE_NO_VIDEO } from "@/server/media/staff-upload";
import { submitListing } from "@/server/listings/service";
import { Category, Listing, MediaAsset, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** FIX-1 (E1-B4): a seller can never save a video on a people listing, by the same rule the staff upload uses. */

function mp4(seconds: number) {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom0000isom")), box("mdat", Buffer.alloc(1000)), box("moov", box("mvhd", mvhd))]);
}

const created: string[] = [];

async function owner() {
  const user = await User.create({
    email: "ada@example.com",
    passwordHash: "h",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles: ["user"],
    verificationStatus: "unsubmitted",
    status: "active",
  });
  return user._id.toString();
}

async function adIn(ownerId: string, categoryId: mongoose.Types.ObjectId, slug: string) {
  const doc = await Listing.create({ ownerId, categoryId, title: "Ad", description: "An ad", slug });
  return doc._id.toString();
}

beforeAll(async () => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.VERCEL;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  // The watermark is on by default and refuses a local video for its own reason; switch it off so only the people rule is in play.
  await mongoose.connection.collection("watermark_settings").insertOne({ key: "default", enabled: false, position: "south_east", opacity: 60 });
});
afterEach(async () => {
  for (const id of created.splice(0)) {
    for (const ext of ["mp4", "webm", "mov", "png"]) await rm(path.join(process.cwd(), "public", "uploads", `${id}.${ext}`), { force: true });
  }
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("FIX-1: no video on people listings", () => {
  it("refuses to sign a video for an ad in a people category (kind people)", async () => {
    const userId = await owner();
    const people = await Category.create({ slug: "meet-up", name: "Meet up", enabled: true, order: 0, kind: "people" });
    const listingId = await adIn(userId, people._id, "ad-people-kind");
    await expect(signMedia(userId, { listingId, contentType: "video/mp4", byteSize: mp4(5).length, kind: "video" }, "req")).rejects.toThrow(STAFF_PEOPLE_NO_VIDEO);
    expect(await MediaAsset.countDocuments({ listingId })).toBe(0);
  });

  it("refuses by the people slugs even when the category has another kind", async () => {
    const userId = await owner();
    const dating = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, kind: "goods" });
    const listingId = await adIn(userId, dating._id, "ad-people-slug");
    await expect(signMedia(userId, { listingId, contentType: "video/mp4", byteSize: mp4(5).length, kind: "video" }, "req")).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("still signs a video for an ordinary category", async () => {
    const userId = await owner();
    const goods = await Category.create({ slug: "classifieds", name: "Classifieds", enabled: true, order: 1, kind: "goods" });
    const listingId = await adIn(userId, goods._id, "ad-goods");
    const signed = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: mp4(5).length, kind: "video" }, "req");
    created.push(signed.mediaId);
    expect(signed.mode).toBe("local");
  });

  it("still signs a photo for a people category", async () => {
    const userId = await owner();
    const people = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, kind: "people" });
    const listingId = await adIn(userId, people._id, "ad-people-photo");
    const signed = await signMedia(userId, { listingId, contentType: "image/png", byteSize: 1000, kind: "image" }, "req");
    created.push(signed.mediaId);
    expect(signed.mode).toBe("local");
  });

  it("a video slot made before the rule cannot be filled on a people ad", async () => {
    const userId = await owner();
    const people = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, kind: "people" });
    const listingId = await adIn(userId, people._id, "ad-people-old-slot");
    const asset = await MediaAsset.create({ ownerId: userId, listingId, kind: "video", objectKey: "pending-local:x", status: "uploaded", contentType: "video/mp4", bytes: 1000 });
    created.push(asset._id.toString());
    await expect(saveLocalMedia(userId, asset._id.toString(), { type: "video/mp4", data: mp4(5) }, "req")).rejects.toThrow(STAFF_PEOPLE_NO_VIDEO);
    const after = await MediaAsset.findById(asset._id).lean();
    expect(after?.status).not.toBe("cleared");
  });

  it("publishing a people ad that already holds a video is refused, and goes through once the video is gone", async () => {
    const user = await User.create({ email: "asha@example.com", displayName: "Asha", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
    const userId = String(user._id);
    const people = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, kind: "people" });
    const draft = await Listing.create({ ownerId: user._id, categoryId: people._id, title: "Coffee and a walk", description: "Looking to meet for coffee and a walk.", status: "draft", cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, attributes: { age: 28 } });
    // A video put there before the rule existed.
    const video = await MediaAsset.create({ ownerId: user._id, listingId: draft._id, kind: "video", objectKey: "/uploads/old.mp4", status: "cleared", contentType: "video/mp4", bytes: 1000 });
    const attest = { adult: true, accurate: true, rights: true } as const;
    await expect(submitListing(String(draft._id), userId, attest, "r1")).rejects.toThrow(STAFF_PEOPLE_NO_VIDEO);
    await MediaAsset.deleteOne({ _id: video._id });
    await expect(submitListing(String(draft._id), userId, attest, "r2")).resolves.toBeTruthy();
  });
});
