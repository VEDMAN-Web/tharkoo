import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { DELETE, GET, PATCH, POST } from "@/app/api/media/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { setCloudinaryClient, type CloudinaryClient } from "@/server/media/client";
import { signUploadParams } from "@/server/media/sign";
import { setCsamScanner } from "@/server/media/service";
import { AuditEvent, Listing, MediaAsset, Session, User } from "@/server/models";
import { dryRunRequested } from "../../../scripts/media-orphan-sweep";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const secret = "test-secret";
const prefix = "tharkoo_test";
const maxBytes = 8 * 1024 * 1024;

function cloudEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = secret;
  process.env.CLOUDINARY_FOLDER_PREFIX = prefix;
  process.env.CSAM_PROVIDER = "stub";
}

async function account(email: string, roles = ["user"]) {
  const user = await User.create({
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
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

async function listingFor(ownerId: string, badges: string[] = []) {
  const doc = await Listing.create({
    ownerId,
    categoryId: new mongoose.Types.ObjectId(),
    title: "Desk",
    description: "A wooden desk",
    badges,
  });
  return doc._id.toString();
}

function fakeCloud() {
  const remote = new Map<string, { bytes: number; format: string }>();
  const destroyed: { id: string; type: string }[] = [];
  const listed: string[] = [];
  const client: CloudinaryClient = {
    async resource(id) {
      return remote.get(id) ?? null;
    },
    async destroy(id, type) {
      destroyed.push({ id, type });
    },
    async list() {
      return listed;
    },
    signedDownload(id, format, expiresAt) {
      return `https://api.cloudinary.com/v1_1/demo/image/download?public_id=${id}&format=${format}&type=authenticated&expires_at=${expiresAt}`;
    },
  };
  return { remote, destroyed, listed, client };
}

let cloud = fakeCloud();

async function call(method: string, pathname: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const request = new Request(`${origin}/api/media/${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (method === "GET") return GET(request);
  if (method === "PATCH") return PATCH(request);
  if (method === "DELETE") return DELETE(request);
  return POST(request);
}

async function dataOf(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    data: Record<string, unknown> | null;
    error: { code: string; message: string } | null;
  };
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  cloudEnv();
  await connectMemoryMongo();
});

afterAll(async () => {
  setCloudinaryClient(null);
  setCsamScanner(null);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_FOLDER_PREFIX;
  delete process.env.LISTING_PHOTO_LIMIT_FREE;
  delete process.env.CSAM_PROVIDER;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  cloudEnv();
  delete process.env.LISTING_PHOTO_LIMIT_FREE;
  setCsamScanner(null);
  cloud = fakeCloud();
  setCloudinaryClient(cloud.client);
  await clearMemoryMongo();
});

describe("upload signature", () => {
  it("signs the params with the secret, includes a timestamp, and prefixes the folder", () => {
    const params = { timestamp: 1_700_000_000, folder: `${prefix}/listings`, public_id: "abc" };
    const signature = signUploadParams(params, secret);
    const expected = createHash("sha1")
      .update(`folder=${prefix}/listings&public_id=abc&timestamp=1700000000${secret}`)
      .digest("hex");
    expect(signature).toBe(expected);
    expect(signature).toBe(cloudinary.utils.api_sign_request(params, secret));
    expect(signature).not.toBe(signUploadParams(params, "other-secret"));
    expect(params.folder.startsWith(`${prefix}/`)).toBe(true);
    expect(params.timestamp).toBeGreaterThan(0);
  });
});

describe("media routes", () => {
  it("rejects a bad MIME, a file over 8 MB, and a missing session", async () => {
    const owner = await account("ada@example.com");
    const mime = await call("POST", "sign", { contentType: "image/gif", byteSize: 1000, kind: "image" }, owner.cookie);
    const huge = await call(
      "POST",
      "sign",
      { contentType: "image/jpeg", byteSize: maxBytes + 1, kind: "image" },
      owner.cookie,
    );
    const anon = await call("POST", "sign", { contentType: "image/jpeg", byteSize: 1000, kind: "image" });
    expect(mime.status).toBe(400);
    expect((await dataOf(mime)).error?.code).toBe("VALIDATION_ERROR");
    expect(huge.status).toBe(400);
    expect((await dataOf(huge)).error?.code).toBe("VALIDATION_ERROR");
    expect(anon.status).toBe(401);
    expect((await dataOf(anon)).error?.code).toBe("UNAUTHORIZED");
  });

  it("records the asset for the owner and refuses another user", async () => {
    const owner = await account("ada@example.com");
    const other = await account("bea@example.com");
    const listingId = await listingFor(owner.id);
    const signed = await dataOf(
      await call(
        "POST",
        "sign",
        { listingId, contentType: "image/jpeg", byteSize: 1200, kind: "image" },
        owner.cookie,
      ),
    );
    expect(signed.ok).toBe(true);
    const params = signed.data?.params as Record<string, string | number>;
    expect(String(params.folder).startsWith(`${prefix}/`)).toBe(true);
    expect(params.timestamp).toBeTypeOf("number");
    expect(String(params.eager)).toContain("w_480");
    expect(String(params.eager)).toContain("w_1280");
    expect(String(params.eager)).toContain("f_auto,q_auto");
    expect(String(params.transformation)).toContain("fl_strip_profile");
    expect(signed.data?.signature).toBe(signUploadParams(params, secret));
    expect(JSON.stringify(signed.data)).not.toContain(secret);

    const mediaId = String(signed.data?.mediaId);
    const stored = await MediaAsset.findById(mediaId);
    expect(stored?.ownerId.toString()).toBe(owner.id);
    cloud.remote.set(stored!.objectKey, { bytes: 1200, format: "jpg" });

    const done = await call("POST", "complete", { mediaId }, owner.cookie);
    expect(done.status).toBe(200);
    expect((await dataOf(done)).data).toEqual({ status: "scanning" });
    expect((await MediaAsset.findById(mediaId))?.status).toBe("scanning");
    expect(await AuditEvent.countDocuments({ action: "media.complete", targetId: mediaId })).toBe(1);

    const stolen = await call("POST", "complete", { mediaId }, other.cookie);
    expect(stolen.status).toBe(404);

    const reorder = await call(
      "PATCH",
      "reorder",
      { listingId, orderedMediaIds: [mediaId] },
      other.cookie,
    );
    expect(reorder.status).toBe(403);
  });

  it("enforces free and promoted photo limits", async () => {
    const owner = await account("ada@example.com");
    const freeId = await listingFor(owner.id);
    const first = await call(
      "POST",
      "sign",
      { listingId: freeId, contentType: "image/png", byteSize: 10, kind: "image" },
      owner.cookie,
    );
    expect(first.status).toBe(200);
    const second = await call(
      "POST",
      "sign",
      { listingId: freeId, contentType: "image/png", byteSize: 10, kind: "image" },
      owner.cookie,
    );
    expect(second.status).toBe(422);
    expect((await dataOf(second)).error?.code).toBe("POLICY_VIOLATION");

    process.env.LISTING_PHOTO_LIMIT_FREE = "2";
    const tuned = await listingFor(owner.id);
    expect(
      (await call("POST", "sign", { listingId: tuned, contentType: "image/webp", byteSize: 10, kind: "image" }, owner.cookie)).status,
    ).toBe(200);
    expect(
      (await call("POST", "sign", { listingId: tuned, contentType: "image/webp", byteSize: 10, kind: "image" }, owner.cookie)).status,
    ).toBe(200);
    expect(
      (await call("POST", "sign", { listingId: tuned, contentType: "image/webp", byteSize: 10, kind: "image" }, owner.cookie)).status,
    ).toBe(422);

    const promotedId = await listingFor(owner.id, ["featured"]);
    for (let index = 0; index < 10; index += 1) {
      const response = await call(
        "POST",
        "sign",
        { listingId: promotedId, contentType: "image/jpeg", byteSize: 10, kind: "image" },
        owner.cookie,
      );
      expect(response.status).toBe(200);
    }
    const eleventh = await call(
      "POST",
      "sign",
      { listingId: promotedId, contentType: "image/jpeg", byteSize: 10, kind: "image" },
      owner.cookie,
    );
    expect(eleventh.status).toBe(422);
  });

  it("keeps identity documents on the authenticated type and expires the signed URL", async () => {
    const owner = await account("ada@example.com");
    const staff = await account("staff@example.com", ["trust_safety"]);
    const signed = await dataOf(
      await call("POST", "sign", { contentType: "image/jpeg", byteSize: 2000, kind: "id_document" }, owner.cookie),
    );
    const params = signed.data?.params as Record<string, string | number>;
    expect(params.type).toBe("authenticated");
    expect(params.eager).toBeUndefined();
    expect(String(params.folder)).toBe(`${prefix}/id`);
    const mediaId = String(signed.data?.mediaId);
    const stored = await MediaAsset.findById(mediaId);
    cloud.remote.set(stored!.objectKey, { bytes: 2000, format: "jpg" });
    expect((await call("POST", "complete", { mediaId }, owner.cookie)).status).toBe(200);

    const meta = await dataOf(await call("GET", mediaId, undefined, owner.cookie));
    const text = JSON.stringify(meta.data);
    expect(text).not.toContain("res.cloudinary.com");
    expect(text).not.toContain("/image/upload/");
    expect(meta.data?.status).toBe("scanning");

    setCloudinaryClient(null);
    const { signedIdDocumentUrl } = await import("@/server/media/service");
    const link = await signedIdDocumentUrl(owner.id, ["user"], mediaId);
    const expires = Number(new URL(link.url).searchParams.get("expires_at"));
    const now = Math.floor(Date.now() / 1000);
    expect(link.url).not.toContain("/image/upload/");
    expect(link.url).not.toContain("res.cloudinary.com");
    expect(link.url).toContain("type=authenticated");
    expect(expires).toBeGreaterThan(now);
    expect(expires).toBeLessThanOrEqual(now + 120);
    expect(new Date(link.expiresAt).getTime()).toBe(expires * 1000);

    const stranger = await dataOf(await call("GET", mediaId, undefined, staff.cookie));
    expect(stranger.ok).toBe(true);
    expect(JSON.stringify(stranger.data)).not.toContain("res.cloudinary.com");
  });

  it("fails closed when Cloudinary env is missing", async () => {
    const owner = await account("ada@example.com");
    delete process.env.CLOUDINARY_API_SECRET;
    const response = await call("POST", "sign", { contentType: "image/jpeg", byteSize: 10, kind: "image" }, owner.cookie);
    const body = await dataOf(response);
    expect(response.status).toBe(500);
    expect(body.error?.message).toContain("CLOUDINARY_API_SECRET");
    expect(body.error?.message).not.toContain(secret);
  });
});

describe("orphan sweep", () => {
  it("supports a dry run and deletes only stale uploads when applied", async () => {
    expect(dryRunRequested(["node", "media-orphan-sweep.ts", "--dry-run"])).toBe(true);
    expect(dryRunRequested(["node", "media-orphan-sweep.ts"])).toBe(false);

    const owner = await account("ada@example.com");
    const staleSign = await dataOf(
      await call("POST", "sign", { contentType: "image/jpeg", byteSize: 10, kind: "image" }, owner.cookie),
    );
    const freshSign = await dataOf(
      await call("POST", "sign", { contentType: "image/png", byteSize: 10, kind: "image" }, owner.cookie),
    );
    const staleId = String(staleSign.data?.mediaId);
    const freshId = String(freshSign.data?.mediaId);
    await MediaAsset.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(staleId) },
      { $set: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    );
    const stale = await MediaAsset.findById(staleId);
    cloud.listed.push(`${prefix}/listings/not-in-db`, stale!.objectKey);

    const { sweepOrphans } = await import("@/server/media/service");
    const preview = await sweepOrphans({ dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.deleted).toBe(0);
    expect(preview.staleIds).toEqual([staleId]);
    expect(preview.remoteIds).toEqual([`${prefix}/listings/not-in-db`]);
    expect((await MediaAsset.findById(staleId))?.status).toBe("uploaded");
    expect(cloud.destroyed).toEqual([]);

    const applied = await sweepOrphans({ dryRun: false });
    expect(applied.deleted).toBe(2);
    expect((await MediaAsset.findById(staleId))?.status).toBe("deleted");
    expect((await MediaAsset.findById(freshId))?.status).toBe("uploaded");
    expect(cloud.destroyed.map((row) => row.id).sort()).toEqual([stale!.objectKey, `${prefix}/listings/not-in-db`].sort());
  });
});
