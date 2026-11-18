import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/media/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { setCloudinaryClient, type CloudinaryClient, type RemoteAsset } from "@/server/media/client";
import { STAFF_NOT_SIGNED, STAFF_PEOPLE_NO_VIDEO, STAFF_PHOTO_REFUSED } from "@/server/media/staff-upload";
import { AuditEvent, Category, MediaAsset, Session, SiteMedia, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H13.1: staff photos and videos go straight to Cloudinary. The Cloudinary calls are all mocked here: nothing is ever sent to the real one. */

const origin = "http://127.0.0.1:4317";
const MB = 1024 * 1024;

function cloudEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  process.env.CSAM_PROVIDER = "stub";
}

async function account(email: string, roles: string[]) {
  const user = await User.create({ email, passwordHash: "hash", displayName: email.split("@")[0], dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date(), emailVerifiedAt: new Date(), roles, verificationStatus: "unsubmitted", status: "active" });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: String(user._id), cookie: `sid=${encodeURIComponent(token)}` };
}

const remote = new Map<string, RemoteAsset>();
const destroyed: string[] = [];
const client: CloudinaryClient = {
  async resource(id) {
    return remote.get(id) ?? null;
  },
  async destroy(id) {
    destroyed.push(id);
  },
  async list() {
    return [];
  },
  signedDownload: () => "",
};

async function call(path: string, body: unknown, cookie?: string) {
  const headers = new Headers({ origin, "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  const response = await POST(new Request(`${origin}/api/media/${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } } };
}

const sign = (cookie: string | undefined, extra: Record<string, unknown> = {}) =>
  call("staff-sign", { purpose: "ad", kind: "image", contentType: "image/jpeg", byteSize: 6 * MB, ...extra }, cookie);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  cloudEnv();
  await connectMemoryMongo();
});
afterAll(async () => {
  setCloudinaryClient(null);
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CSAM_PROVIDER"]) delete process.env[key];
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  cloudEnv();
  remote.clear();
  destroyed.length = 0;
  setCloudinaryClient(client);
  await clearMemoryMongo();
});

describe("H13.1 A1: who may get a signature", () => {
  it("refuses a visitor who is not signed in, a member, and a staff role without the permission; signs for an admin with the owner set", async () => {
    const admin = await account("admin@example.test", ["admin"]);
    const support = await account("support@example.test", ["support"]);
    const member = await account("member@example.test", ["user"]);
    const owner = await account("owner@example.test", ["user"]);
    expect((await sign(undefined)).status).toBe(401);
    expect((await sign(member.cookie)).status).toBe(403);
    expect((await sign(support.cookie)).status).toBe(403);
    const library = await call("staff-sign", { purpose: "library", kind: "image", contentType: "image/png", byteSize: MB }, support.cookie);
    expect(library.status).toBe(403);
    const ok = await sign(admin.cookie, { ownerEmail: "owner@example.test" });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ mode: "cloudinary", uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload" });
    const mediaId = String(ok.body.data?.mediaId);
    expect(String((await MediaAsset.findById(mediaId).lean())?.ownerId)).toBe(owner.id);
    const event = await AuditEvent.findOne({ action: "media.staff_sign", targetId: mediaId }).lean();
    expect(String(event?.actorId)).toBe(admin.id);
    // The Media library signs for an admin too (who may edit the site), with no owner account.
    expect((await call("staff-sign", { purpose: "library", kind: "image", contentType: "image/png", byteSize: MB }, admin.cookie)).status).toBe(200);
  });

  it("keeps the type and size rules: a photo over 8 MB, a wrong type, and a video on a people category are refused in plain words", async () => {
    const admin = await account("admin@example.test", ["admin"]);
    const tooBig = await sign(admin.cookie, { byteSize: 9 * MB });
    expect(tooBig.status).toBeGreaterThanOrEqual(400);
    expect(tooBig.body.error?.message).toBe(STAFF_PHOTO_REFUSED);
    expect((await sign(admin.cookie, { contentType: "image/gif" })).body.error?.message).toBe(STAFF_PHOTO_REFUSED);
    const people = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 0, kind: "people" });
    const video = await call("staff-sign", { purpose: "ad", kind: "video", contentType: "video/mp4", byteSize: 5 * MB, categoryId: String(people._id) }, admin.cookie);
    expect(video.body.error?.message).toBe(STAFF_PEOPLE_NO_VIDEO);
    const goods = await Category.create({ slug: "classifieds", name: "Classifieds", enabled: true, order: 1, kind: "goods" });
    expect((await call("staff-sign", { purpose: "ad", kind: "video", contentType: "video/mp4", byteSize: 5 * MB, categoryId: String(goods._id) }, admin.cookie)).status).toBe(200);
    expect((await call("staff-sign", { purpose: "ad", kind: "video", contentType: "video/mp4", byteSize: 11 * MB }, admin.cookie)).status).toBeGreaterThanOrEqual(400);
  });
});

describe("H13.1 A2: completing an upload", () => {
  it("refuses a media id that was not signed for that staff member, and an unknown one", async () => {
    const first = await account("first@example.test", ["admin"]);
    const second = await account("second@example.test", ["admin"]);
    const signed = await sign(first.cookie);
    const mediaId = String(signed.body.data?.mediaId);
    remote.set(`tharkoo/listings/${mediaId}`, { bytes: 6 * MB, format: "jpg" });
    const other = await call("staff-complete", { purpose: "ad", mediaId }, second.cookie);
    expect(other.status).toBe(403);
    expect(other.body.error?.message).toBe(STAFF_NOT_SIGNED);
    expect((await call("staff-complete", { purpose: "ad", mediaId: new mongoose.Types.ObjectId().toHexString() }, first.cookie)).status).toBe(403);
    // The right staff member, the wrong screen.
    expect((await call("staff-complete", { purpose: "library", mediaId }, first.cookie)).status).toBe(403);
  });

  it("clears a 6 MB photo that is really there, with the owner and an audit row for the staff member and the owner; refuses one that is really too big", async () => {
    const admin = await account("admin@example.test", ["admin"]);
    const owner = await account("owner@example.test", ["user"]);
    const signed = await sign(admin.cookie, { ownerEmail: "owner@example.test" });
    const mediaId = String(signed.body.data?.mediaId);
    remote.set(`tharkoo/listings/${mediaId}`, { bytes: 6 * MB, format: "jpg" });
    const done = await call("staff-complete", { purpose: "ad", mediaId, fileName: "desk.jpg" }, admin.cookie);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ mediaId, kind: "image", name: "desk.jpg" });
    expect(await MediaAsset.findById(mediaId).lean()).toMatchObject({ status: "cleared", bytes: 6 * MB });
    const event = await AuditEvent.findOne({ action: "media.admin_upload", targetId: mediaId }).lean();
    expect(String(event?.actorId)).toBe(admin.id);
    expect(String((event?.after as { ownerId?: string })?.ownerId)).toBe(owner.id);

    const second = await sign(admin.cookie);
    const bigId = String(second.body.data?.mediaId);
    remote.set(`tharkoo/listings/${bigId}`, { bytes: 9 * MB, format: "jpg" });
    const refused = await call("staff-complete", { purpose: "ad", mediaId: bigId }, admin.cookie);
    expect(refused.body.error?.message).toBe(STAFF_PHOTO_REFUSED);
    expect(destroyed).toContain(`tharkoo/listings/${bigId}`);
    expect((await MediaAsset.findById(bigId).lean())?.status).toBe("rejected_policy");
  });

  it("the Media library keeps a 6 MB image with its size, alt text from the file name and tags", async () => {
    const admin = await account("admin@example.test", ["admin"]);
    const signed = await call("staff-sign", { purpose: "library", kind: "image", contentType: "image/png", byteSize: 6 * MB }, admin.cookie);
    const mediaId = String(signed.body.data?.mediaId);
    remote.set(`tharkoo/site/${mediaId}`, { bytes: 6 * MB, format: "png", width: 4000, height: 3000, url: `https://res.cloudinary.com/demo/image/upload/tharkoo/site/${mediaId}.png` });
    const done = await call("staff-complete", { purpose: "library", mediaId, fileName: "red-sofa-in-room.png", autoAlt: true, tags: "sofa, room" }, admin.cookie);
    expect(done.status).toBe(200);
    const row = await SiteMedia.findById(String(done.body.data?.id)).lean();
    expect(row).toMatchObject({ width: 4000, height: 3000, bytes: 6 * MB, contentType: "image/png", uploadedBy: "admin@example.test" });
    expect(row?.alt.length).toBeGreaterThan(0);
  });
});
