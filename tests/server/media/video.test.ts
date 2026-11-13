import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as serveVideo } from "@/app/ad/video/[file]/route";
import { videoSeconds } from "@/server/media/duration";
import { completeMedia, saveLocalMedia, signMedia } from "@/server/media/service";
import { setCloudinaryClient, type CloudinaryClient } from "@/server/media/client";
import { dismissVideoReports, listAdVideos, listOwnAdVideos, removeVideoAsAdmin } from "@/server/media/video";
import { fileReport } from "@/server/reports/service";
import { VideoReport } from "@/server/reports/video-report";
import { AuditEvent, Listing, MediaAsset, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** A minimal mp4 whose mvhd says it lasts `seconds`. moov goes last, as in a non-faststart file. */
function mp4(seconds: number, pad = 0) {
  const box = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body]);
  };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom0000isom")), box("mdat", Buffer.alloc(pad)), box("moov", box("mvhd", mvhd))]);
}

function webm(seconds: number) {
  const duration = Buffer.alloc(4);
  duration.writeFloatBE(seconds * 1000, 0);
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]),
    Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]),
    Buffer.from([0x44, 0x89, 0x84]),
    duration,
  ]);
}

const created: string[] = [];
async function owner(email = "ada@example.com") {
  const user = await User.create({
    email,
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
async function ad(ownerId: string) {
  const doc = await Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    title: "Desk",
    description: "A desk",
    slug: "desk-1",
  });
  return doc._id.toString();
}
async function upload(userId: string, listingId: string, data: Buffer, type = "video/mp4") {
  const signed = await signMedia(userId, { listingId, contentType: type, byteSize: data.length, kind: "video" }, "req");
  created.push(signed.mediaId);
  const saved = await saveLocalMedia(userId, signed.mediaId, { type, data }, "req");
  return { id: signed.mediaId, saved };
}

beforeAll(async () => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.VERCEL;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterEach(async () => {
  for (const id of created.splice(0)) {
    for (const ext of ["mp4", "webm", "mov"]) await rm(path.join(process.cwd(), "public", "uploads", `${id}.${ext}`), { force: true });
  }
  setCloudinaryClient(null);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("video length", () => {
  it("reads mp4 and webm lengths, and null for junk", () => {
    expect(videoSeconds(mp4(12, 5000), "video/mp4")).toBeCloseTo(12, 1);
    expect(videoSeconds(mp4(12), "video/quicktime")).toBeCloseTo(12, 1);
    expect(videoSeconds(webm(8), "video/webm")).toBeCloseTo(8, 1);
    expect(videoSeconds(Buffer.from("not a video"), "video/mp4")).toBeNull();
  });
});

describe("video upload rules", () => {
  it("stores a valid clip, shows it publicly and keeps it out of the photo list", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    const { saved } = await upload(userId, listingId, mp4(20));
    expect(saved.status).toBe("cleared");
    const listing = await Listing.findById(listingId).lean();
    expect(listing?.mediaIds ?? []).toHaveLength(0);
    expect(await listAdVideos(listingId)).toHaveLength(1);
    expect(await listOwnAdVideos(userId, listingId)).toHaveLength(1);
  });

  it("rejects a clip longer than 30 seconds", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    const data = mp4(31);
    const signed = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: data.length, kind: "video" }, "req");
    created.push(signed.mediaId);
    await expect(saveLocalMedia(userId, signed.mediaId, { type: "video/mp4", data }, "req")).rejects.toThrow(/30 seconds/);
    expect(await listAdVideos(listingId)).toHaveLength(0);
  });

  it("rejects wrong types and clips over 10 MB at the signing step", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    await expect(signMedia(userId, { listingId, contentType: "video/x-msvideo", byteSize: 1000, kind: "video" }, "r")).rejects.toThrow();
    await expect(signMedia(userId, { listingId, contentType: "video/mp4", byteSize: 10 * 1024 * 1024 + 1, kind: "video" }, "r")).rejects.toThrow();
  });

  it("rejects an oversized body even if the signed size was small", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    const signed = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: 1000, kind: "video" }, "r");
    created.push(signed.mediaId);
    await expect(saveLocalMedia(userId, signed.mediaId, { type: "video/mp4", data: mp4(5, 10 * 1024 * 1024) }, "r")).rejects.toThrow();
  });

  it("allows at most 2 videos per ad and only for the ad owner", async () => {
    const userId = await owner();
    const other = await owner("bob@example.com");
    const listingId = await ad(userId);
    await upload(userId, listingId, mp4(5));
    await upload(userId, listingId, mp4(6));
    await expect(signMedia(userId, { listingId, contentType: "video/mp4", byteSize: 100, kind: "video" }, "r")).rejects.toThrow(/limit/i);
    await expect(signMedia(other, { listingId, contentType: "video/mp4", byteSize: 100, kind: "video" }, "r")).rejects.toThrow();
  });
});

describe("local video file route", () => {
  it("serves the file, honours Range, and refuses other names", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    const { id } = await upload(userId, listingId, mp4(5));
    const ctx = (file: string) => ({ params: Promise.resolve({ file }) });
    const whole = await serveVideo(new Request("http://x/ad/video/a"), ctx(`${id}.mp4`));
    expect(whole.status).toBe(200);
    expect(whole.headers.get("content-type")).toBe("video/mp4");
    const part = await serveVideo(new Request("http://x/ad/video/a", { headers: { range: "bytes=0-9" } }), ctx(`${id}.mp4`));
    expect(part.status).toBe(206);
    expect((await part.arrayBuffer()).byteLength).toBe(10);
    expect((await serveVideo(new Request("http://x"), ctx("../secret.mp4"))).status).toBe(404);
    expect((await listAdVideos(listingId))[0]?.url).toBe(`/ad/video/${id}.mp4`);
  });
});

describe("Cloudinary video path", () => {
  it("checks length and size reported by the provider", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "k";
    process.env.CLOUDINARY_API_SECRET = "s";
    process.env.CSAM_PROVIDER = "stub";
    try {
      const userId = await owner();
      const listingId = await ad(userId);
      const remote = new Map<string, { bytes: number; format: string; duration: number }>();
      const destroyed: string[] = [];
      setCloudinaryClient({
        resource: async (id) => remote.get(id) ?? null,
        destroy: async (id) => void destroyed.push(id),
        list: async () => [],
        signedDownload: () => "",
      } satisfies CloudinaryClient);
      const good = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: 1000, kind: "video" }, "r");
      expect(good.uploadUrl).toContain("/video/upload");
      expect(good.params).not.toHaveProperty("eager");
      const goodAsset = await MediaAsset.findById(good.mediaId);
      remote.set(goodAsset!.objectKey, { bytes: 1000, format: "mp4", duration: 12 });
      expect((await completeMedia(userId, good.mediaId, "r")).status).toBe("cleared");
      expect((await listAdVideos(listingId))[0]?.posterUrl).toContain("/video/upload/so_0");

      const bad = await signMedia(userId, { listingId, contentType: "video/mp4", byteSize: 1000, kind: "video" }, "r");
      const badAsset = await MediaAsset.findById(bad.mediaId);
      remote.set(badAsset!.objectKey, { bytes: 1000, format: "mp4", duration: 45 });
      await expect(completeMedia(userId, bad.mediaId, "r")).rejects.toThrow(/30 seconds/);
      expect(destroyed).toContain(badAsset!.objectKey);
    } finally {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
    }
  });
});

describe("video reports and removal", () => {
  function reportFrom(ip: string) {
    return fileReport({ ad: "desk-1", reason: "video", details: "bad", ip });
  }

  it("hides the videos at 3 open reports from different people, and not before", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    await upload(userId, listingId, mp4(5));
    await reportFrom("1.1.1.1");
    await reportFrom("1.1.1.1");
    await reportFrom("2.2.2.2");
    expect(await listAdVideos(listingId)).toHaveLength(1);
    await reportFrom("3.3.3.3");
    expect(await listAdVideos(listingId)).toHaveLength(0);
    expect(await VideoReport.countDocuments({ status: "open" })).toBe(4);
  });

  it("shows the videos again after an admin dismisses the reports, and audits it", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    await upload(userId, listingId, mp4(5));
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) await reportFrom(ip);
    await dismissVideoReports({ email: "admin@example.com", roles: ["admin"] }, listingId);
    expect(await listAdVideos(listingId)).toHaveLength(1);
    expect(await AuditEvent.countDocuments({ action: "video.reports_dismissed" })).toBe(1);
    await expect(dismissVideoReports({ email: "u@example.com", roles: ["user"] }, listingId)).rejects.toThrow();
  });

  it("lets an admin remove a single video and audits the removal", async () => {
    const userId = await owner();
    const listingId = await ad(userId);
    const first = await upload(userId, listingId, mp4(5));
    await upload(userId, listingId, mp4(6));
    await removeVideoAsAdmin({ email: "admin@example.com", roles: ["admin"] }, first.id);
    expect(await listAdVideos(listingId)).toHaveLength(1);
    expect((await MediaAsset.findById(first.id))?.status).toBe("deleted");
    expect(await AuditEvent.countDocuments({ action: "video.remove", targetId: first.id })).toBe(1);
    await expect(removeVideoAsAdmin({ email: "u@example.com", roles: ["user"] }, first.id)).rejects.toThrow();
  });
});
