import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { patchListing } from "@/server/listings/service";
import { listDraftMedia, listMyMedia, LIVE_COVER_MESSAGE, removeMyMedia } from "@/server/media/mine";
import { AuditEvent, Listing, MediaAsset } from "@/server/models";
import { NotFoundError } from "@/server/http";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const categoryId = new mongoose.Types.ObjectId();

function owner() {
  return new mongoose.Types.ObjectId();
}

async function adFor(ownerId: mongoose.Types.ObjectId, status = "draft", title = "Desk") {
  const doc = await Listing.create({ ownerId, categoryId, title, description: "A wooden desk", status });
  return doc;
}

async function photo(ownerId: mongoose.Types.ObjectId, listingId: mongoose.Types.ObjectId | null, status: string, name: string, createdAt = new Date()) {
  const doc = await MediaAsset.create({
    ownerId,
    listingId: listingId ?? undefined,
    kind: "image",
    objectKey: `/uploads/${name}.jpg`,
    status,
    contentType: "image/jpeg",
    bytes: 204800,
    createdAt,
  });
  return doc;
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
  delete process.env.LISTING_PHOTO_LIMIT_FREE;
});

describe("owner-only library", () => {
  it("lists only the signed-in owner's own photos and videos", async () => {
    const alice = owner();
    const bob = owner();
    const aliceAd = await adFor(alice);
    const bobAd = await adFor(bob);
    await photo(alice, aliceAd._id, "cleared", "a1");
    await photo(bob, bobAd._id, "cleared", "b1");

    const { rows } = await listMyMedia(alice.toString());
    expect(rows).toHaveLength(1);
    expect(rows[0].listingId).toBe(aliceAd._id.toString());
    expect(rows.some((row) => row.listingId === bobAd._id.toString())).toBe(false);
  });

  it("never lists ID documents, even when one is linked to an ad", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    await MediaAsset.create({ ownerId: alice, kind: "id_document", objectKey: "private:id1.jpg", status: "cleared", contentType: "image/jpeg" });
    await MediaAsset.create({ ownerId: alice, listingId: ad._id, kind: "id_document", objectKey: "private:id2.jpg", status: "cleared", contentType: "image/jpeg" });
    await photo(alice, ad._id, "cleared", "p1");

    const { rows } = await listMyMedia(alice.toString());
    expect(rows.map((row) => row.kind)).toEqual(["image"]);
  });

  it("filters photos and videos", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    await photo(alice, ad._id, "cleared", "p2");
    await MediaAsset.create({ ownerId: alice, listingId: ad._id, kind: "video", objectKey: "/uploads/v1.mp4", status: "cleared", contentType: "video/mp4" });

    expect((await listMyMedia(alice.toString(), "all")).rows).toHaveLength(2);
    const photos = (await listMyMedia(alice.toString(), "photos")).rows;
    expect(photos.map((row) => row.kind)).toEqual(["image"]);
    const videos = (await listMyMedia(alice.toString(), "videos")).rows;
    expect(videos.map((row) => row.kind)).toEqual(["video"]);
  });

  it("shows live, being checked and refused items, with the reason for a refusal, and hides unfinished uploads", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    await photo(alice, ad._id, "cleared", "live1");
    await photo(alice, ad._id, "scanning", "check1");
    await photo(alice, ad._id, "rejected_policy", "bad1");
    await photo(alice, ad._id, "uploaded", "never1");

    const rows = (await listMyMedia(alice.toString())).rows;
    const byState = Object.fromEntries(rows.map((row) => [row.state, row]));
    expect(rows).toHaveLength(3);
    expect(byState.live).toBeDefined();
    expect(byState.checking).toBeDefined();
    expect(byState.refused.reason).toMatch(/JPG, PNG or WebP/);
  });

  it("orders newest first", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    await photo(alice, ad._id, "cleared", "old", new Date("2026-01-01T00:00:00Z"));
    await photo(alice, ad._id, "cleared", "new", new Date("2026-06-01T00:00:00Z"));

    const rows = (await listMyMedia(alice.toString())).rows;
    expect(rows[0].url).toContain("new.jpg");
  });
});

describe("draft photo step", () => {
  it("returns the ad's photos in order with its cover and limit, and refuses a non-owner", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    const first = await photo(alice, ad._id, "cleared", "d1");
    const second = await photo(alice, ad._id, "scanning", "d2");
    await Listing.updateOne({ _id: ad._id }, { $set: { mediaIds: [second._id, first._id], coverMediaId: first._id } });

    const draft = await listDraftMedia(alice.toString(), ad._id.toString());
    expect(draft.photos.map((row) => row.id)).toEqual([second._id.toString(), first._id.toString()]);
    expect(draft.coverId).toBe(first._id.toString());
    expect(draft.limit).toBe(1);

    await expect(listDraftMedia(owner().toString(), ad._id.toString())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets a photo still being checked be attached, but not an unfinished upload", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    const checking = await photo(alice, ad._id, "scanning", "attach1");
    const unfinished = await photo(alice, ad._id, "uploaded", "attach2");

    const ok = await patchListing(ad._id.toString(), alice.toString(), { stage: "photos", mediaIds: [checking._id.toString()] }, "req-1");
    expect(ok.mediaIds).toEqual([checking._id.toString()]);
    await expect(
      patchListing(ad._id.toString(), alice.toString(), { stage: "photos", mediaIds: [unfinished._id.toString()] }, "req-2"),
    ).rejects.toThrow("MEDIA_NOT_CLEARED");
  });
});

describe("remove", () => {
  it("refuses another owner's item as not found", async () => {
    const alice = owner();
    const ad = await adFor(alice);
    const item = await photo(alice, ad._id, "cleared", "rm-other");
    await expect(removeMyMedia(owner().toString(), item._id.toString(), "req")).rejects.toBeInstanceOf(NotFoundError);
    expect(await MediaAsset.findById(item._id)).not.toBeNull();
  });

  it("keeps a live ad's cover photo", async () => {
    const alice = owner();
    const ad = await adFor(alice, "active");
    const cover = await photo(alice, ad._id, "cleared", "cover1");
    await Listing.updateOne({ _id: ad._id }, { $set: { mediaIds: [cover._id], coverMediaId: cover._id } });

    await expect(removeMyMedia(alice.toString(), cover._id.toString(), "req")).rejects.toThrow(LIVE_COVER_MESSAGE);
    expect((await MediaAsset.findById(cover._id))?.status).toBe("cleared");
    expect((await Listing.findById(ad._id))?.coverMediaId?.toString()).toBe(cover._id.toString());
  });

  it("removes a non-cover photo from a live ad and audits it", async () => {
    const alice = owner();
    const ad = await adFor(alice, "active");
    const cover = await photo(alice, ad._id, "cleared", "cover2");
    const extra = await photo(alice, ad._id, "cleared", "extra2");
    await Listing.updateOne({ _id: ad._id }, { $set: { mediaIds: [cover._id, extra._id], coverMediaId: cover._id } });

    await removeMyMedia(alice.toString(), extra._id.toString(), "req-extra");
    const after = await Listing.findById(ad._id);
    expect(after?.mediaIds.map(String)).toEqual([cover._id.toString()]);
    expect(after?.coverMediaId?.toString()).toBe(cover._id.toString());
    expect((await MediaAsset.findById(extra._id))?.status).toBe("deleted");
    const audit = await AuditEvent.findOne({ action: "media.remove", requestId: "req-extra" });
    expect(audit).not.toBeNull();
  });

  it("lets a draft's cover go and promotes the next photo to cover", async () => {
    const alice = owner();
    const ad = await adFor(alice, "draft");
    const first = await photo(alice, ad._id, "cleared", "draft1");
    const second = await photo(alice, ad._id, "cleared", "draft2");
    await Listing.updateOne({ _id: ad._id }, { $set: { mediaIds: [first._id, second._id], coverMediaId: first._id } });

    await removeMyMedia(alice.toString(), first._id.toString(), "req-draft");
    const after = await Listing.findById(ad._id);
    expect(after?.mediaIds.map(String)).toEqual([second._id.toString()]);
    expect(after?.coverMediaId?.toString()).toBe(second._id.toString());
  });
});
