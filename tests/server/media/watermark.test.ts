import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/server/auth/http";
import { setCloudinaryUploader, uploadToCloudinary, type UploadOptions } from "@/server/media/client";
import { AD_MEDIA_MAX } from "@/server/media/config";
import { signMedia, saveLocalMedia } from "@/server/media/service";
import { cloudinaryWatermarkTransformation, isWatermarked, localWatermarkSvg, prepareLocalAdFile } from "@/server/media/watermark";
import { watermarkExistingAdMedia } from "@/server/media/watermark-migration";
import { readWatermarkSettings, setWatermarkSettings } from "@/server/settings/watermark";
import { WATERMARK_DEFAULTS, normaliseWatermark } from "@/server/settings/watermark-rules";
import { AuditEvent, Listing, MediaAsset, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const CLOUD_ENV = { CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
const MARK = cloudinaryWatermarkTransformation(WATERMARK_DEFAULTS);
const created: string[] = [];

/** signMedia answers with a different shape for local and Cloudinary uploads. The params are only read here. */
function paramsOf(signed: unknown): Record<string, string | number> {
  return (signed as { params: Record<string, string | number> }).params;
}

async function user(email: string, roles = ["user"]) {
  const doc = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "unsubmitted",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: doc._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: doc._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

async function ad(ownerId: string) {
  const doc = await Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    title: "Desk",
    description: "A desk",
    slug: `desk-${new mongoose.Types.ObjectId().toString()}`,
  });
  return doc._id.toString();
}

async function png(width = 400, height = 300) {
  return sharp({ create: { width, height, channels: 3, background: "#336699" } }).png().toBuffer();
}

async function watermarkOff() {
  await mongoose.connection.collection("watermark_settings").updateOne({ key: "default" }, { $set: { enabled: false } }, { upsert: true });
}

function clearLocalCloudinary() {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
}

beforeAll(async () => {
  delete process.env.MONGODB_URI;
  delete process.env.VERCEL;
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
  Object.assign(process.env, { ...CLOUD_ENV, CSAM_PROVIDER: "stub" });
});

afterEach(async () => {
  for (const id of created.splice(0)) {
    for (const ext of ["png", "jpg", "webp", "mp4"]) await rm(path.join(process.cwd(), "public", "uploads", `${id}.${ext}`), { force: true });
  }
  setCloudinaryUploader(null);
  vi.restoreAllMocks();
  clearLocalCloudinary();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("watermark settings (H6.18)", () => {
  it("is on, bottom right, at 60 percent when nothing is stored, and a bad stored value falls back", async () => {
    expect(await readWatermarkSettings()).toEqual(WATERMARK_DEFAULTS);
    expect(WATERMARK_DEFAULTS).toEqual({ enabled: true, position: "south_east", opacity: 60 });
    expect(normaliseWatermark({ enabled: "yes", position: "left", opacity: 200 })).toEqual(WATERMARK_DEFAULTS);
  });

  it("only a superadmin can change it, the values are checked, and the change is audited", async () => {
    const admin = await user("root@example.com", ["superadmin"]);
    const member = await user("ada@example.com");
    await expect(
      setWatermarkSettings({ actorId: member.id, roles: ["user"], settings: { enabled: false, position: "center", opacity: 40 }, requestId: "r" }),
    ).rejects.toThrow(/superadmin/);
    await expect(
      setWatermarkSettings({ actorId: admin.id, roles: ["superadmin"], settings: { enabled: true, position: "north_east", opacity: 5 }, requestId: "r" }),
    ).rejects.toThrow();
    await setWatermarkSettings({ actorId: admin.id, roles: ["superadmin"], settings: { enabled: false, position: "center", opacity: 40 }, requestId: "r" });
    expect(await readWatermarkSettings()).toEqual({ enabled: false, position: "center", opacity: 40 });
    const audit = await AuditEvent.findOne({ action: "settings.watermark.update" }).lean<{ before: unknown; after: unknown }>();
    expect(audit?.before).toEqual(WATERMARK_DEFAULTS);
    expect(audit?.after).toEqual({ enabled: false, position: "center", opacity: 40 });
  });
});

describe("the mark itself (H6.18)", () => {
  it("draws tharkoo.com at about 22 percent of the width, at the chosen corner and opacity", () => {
    expect(MARK).toContain("l_text:Arial_100_bold:tharkoo.com");
    expect(MARK).toContain("w_0.22,fl_relative");
    expect(MARK).toContain("o_60");
    expect(MARK).toContain("g_south_east");
    expect(cloudinaryWatermarkTransformation({ enabled: true, position: "center", opacity: 40 })).toContain("g_center");
  });

  it("the local mark is exactly 22 percent of the photo width, in the chosen corner", () => {
    const { svg, gravity } = localWatermarkSvg(1000, { enabled: true, position: "north_west", opacity: 60 });
    expect(svg).toContain('textLength="220"');
    expect(svg).toContain("tharkoo.com");
    expect(gravity).toBe("northwest");
  });
});

describe("Cloudinary uploads carry the mark (H6.18)", () => {
  it("an ad photo is uploaded with the mark as an incoming transformation, and recorded as marked", async () => {
    const seen: UploadOptions[] = [];
    setCloudinaryUploader(async (_data, options) => {
      seen.push(options);
      return { url: "https://res.example/x", publicId: `${options.folder}/${options.publicId}` };
    });
    const stored = await uploadToCloudinary(Buffer.from("x"), { contentType: "image/png", folder: "tharkoo/listings", publicId: "abc", transformation: "fl_strip_profile" });
    expect(stored.publicId).toBe("tharkoo/listings/abc");
    expect(seen[0].transformation).toBe(`fl_strip_profile/${MARK}`);
    expect(await isWatermarked("tharkoo/listings/abc")).toBe(true);
  });

  it("site images are not marked, and nothing is recorded for them", async () => {
    const seen: UploadOptions[] = [];
    setCloudinaryUploader(async (_data, options) => {
      seen.push(options);
      return { url: "u", publicId: `${options.folder}/${options.publicId}` };
    });
    await uploadToCloudinary(Buffer.from("x"), { contentType: "image/png", folder: "tharkoo/site", publicId: "banner" });
    expect(seen[0].transformation).toBeUndefined();
    expect(await isWatermarked("tharkoo/site/banner")).toBe(false);
  });

  it("the sign step sends the mark for an ad photo and an ad video, and not when the watermark is off", async () => {
    const owner = await user("ada@example.com");
    const listingId = await ad(owner.id);
    const photoSigned = await signMedia(owner.id, { listingId, contentType: "image/png", byteSize: 10, kind: "image" }, "r");
    expect(paramsOf(photoSigned).transformation).toBe(`fl_strip_profile/${MARK}`);
    expect(paramsOf(photoSigned).eager).toBeDefined();
    expect(await isWatermarked(`tharkoo/listings/${photoSigned.mediaId}`)).toBe(true);
    const videoSigned = await signMedia(owner.id, { listingId, contentType: "video/mp4", byteSize: 10, kind: "video" }, "r");
    expect(paramsOf(videoSigned).transformation).toBe(MARK);

    await watermarkOff();
    const plain = await signMedia(owner.id, { listingId, contentType: "video/mp4", byteSize: 10, kind: "video" }, "r");
    expect(paramsOf(plain).transformation).toBeUndefined();
  });

  it("an identity document is never marked", async () => {
    const owner = await user("ada@example.com");
    const signed = await signMedia(owner.id, { contentType: "image/png", byteSize: 10, kind: "id_document" }, "r");
    expect(String(paramsOf(signed).transformation ?? "")).not.toContain("tharkoo.com");
  });
});

describe("local disk fallback (H6.18)", () => {
  it("an ad photo is written with the mark, which changes its bytes, and is recorded as marked", async () => {
    clearLocalCloudinary();
    const owner = await user("ada@example.com");
    const listingId = await ad(owner.id);
    const signed = await signMedia(owner.id, { listingId, contentType: "image/png", byteSize: 10, kind: "image" }, "r");
    created.push(signed.mediaId);
    const original = await png();
    await saveLocalMedia(owner.id, signed.mediaId, { type: "image/png", data: original }, "r");
    const asset = await MediaAsset.findById(signed.mediaId).lean<{ objectKey: string; bytes: number }>();
    expect(asset?.objectKey).toBe(`/uploads/${signed.mediaId}.png`);
    expect(asset?.bytes).not.toBe(original.length);
    expect(await isWatermarked(asset!.objectKey)).toBe(true);
  });

  it("a local video is refused while the watermark is on, and allowed when it is off", async () => {
    clearLocalCloudinary();
    const owner = await user("ada@example.com");
    const listingId = await ad(owner.id);
    await expect(signMedia(owner.id, { listingId, contentType: "video/mp4", byteSize: 10, kind: "video" }, "r")).rejects.toThrow(/Videos need Cloudinary/);
    await watermarkOff();
    await expect(prepareLocalAdFile("video", { type: "video/mp4", data: Buffer.from("x") })).resolves.toMatchObject({ watermarked: false });
  });
});

describe("existing ad media, daily migration (H6.18)", () => {
  async function storedAd(key: string) {
    const owner = await user(`${key}@example.com`);
    const listingId = await ad(owner.id);
    return MediaAsset.create({
      ownerId: owner.id,
      listingId,
      kind: "image",
      objectKey: `tharkoo/listings/${key}`,
      status: "cleared",
      contentType: "image/jpeg",
      bytes: 10,
    });
  }

  it("marks each old ad photo once, skips the marked ones on the next run, and reports the count", async () => {
    await storedAd("old1");
    await storedAd("old2");
    await storedAd("old3");
    const downloads: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      downloads.push(String(input));
      return new Response(Buffer.from("original-bytes"), { status: 200 });
    });
    const uploads: UploadOptions[] = [];
    setCloudinaryUploader(async (_data, options) => {
      uploads.push(options);
      return { url: "u", publicId: `${options.folder}/${options.publicId}` };
    });

    const first = await watermarkExistingAdMedia("cron:1");
    expect(first).toEqual({ enabled: true, processed: 3, failed: 0 });
    expect(downloads.every((url) => url.includes("/image/upload/tharkoo/listings/old"))).toBe(true);
    expect(uploads.every((options) => options.overwrite === true && options.transformation?.includes("tharkoo.com"))).toBe(true);

    const second = await watermarkExistingAdMedia("cron:2");
    expect(second).toEqual({ enabled: true, processed: 0, failed: 0 });
    expect(uploads).toHaveLength(3);
  });

  it("does nothing while the watermark is off", async () => {
    await storedAd("old4");
    await watermarkOff();
    expect(await watermarkExistingAdMedia("cron:off")).toEqual({ enabled: false, processed: 0, failed: 0 });
  });

  it("the batch size is respected, and the rest waits for the next run", async () => {
    for (let index = 0; index < 4; index += 1) await storedAd(`batch${index}`);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(Buffer.from("b"), { status: 200 }));
    setCloudinaryUploader(async (_data, options) => ({ url: "u", publicId: `${options.folder}/${options.publicId}` }));
    expect((await watermarkExistingAdMedia("cron:b", 2)).processed).toBe(2);
    expect((await watermarkExistingAdMedia("cron:b", 2)).processed).toBe(2);
    expect((await watermarkExistingAdMedia("cron:b", 2)).processed).toBe(0);
  });
});

describe("one limit for every ad (H6.18)", () => {
  it("the shared limit is 10 photos and videos together", () => {
    expect(AD_MEDIA_MAX).toBe(10);
  });
});
