import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as adminGet, POST as adminPost } from "@/app/api/admin/verifications/[[...slug]]/route";
import { GET as userGet, POST as userPost } from "@/app/api/verification/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { setCloudinaryClient, type CloudinaryClient } from "@/server/media/client";
import { AuditEvent, IdentityVerification, MediaAsset, Session, User } from "@/server/models";
import { assertVerified } from "@/server/verification/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";

function cloudEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  process.env.CLOUDINARY_FOLDER_PREFIX = "tharkoo_test";
  process.env.CSAM_PROVIDER = "stub";
  delete process.env.KYC_PROVIDER;
}

function fakeCloud() {
  const remote = new Map<string, { bytes: number; format: string }>();
  const client: CloudinaryClient = {
    async resource(id) {
      return remote.get(id) ?? null;
    },
    async destroy() {},
    async list() {
      return [];
    },
    signedDownload(id, format, expiresAt) {
      return `https://api.cloudinary.com/v1_1/demo/image/download?public_id=${id}&format=${format}&type=authenticated&expires_at=${expiresAt}`;
    },
  };
  return { remote, client };
}

let cloud = fakeCloud();

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

async function call(kind: "user" | "admin", method: string, pathname: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const base = kind === "user" ? "/api/verification" : "/api/admin/verifications";
  const request = new Request(`${origin}${base}${pathname ? `/${pathname}` : ""}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (kind === "user") return method === "GET" ? userGet(request) : userPost(request);
  return method === "GET" ? adminGet(request) : adminPost(request);
}

async function dataOf(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    data: Record<string, unknown> | null;
    error: { code: string; message: string } | null;
  };
}

async function upload(cookie: string) {
  const signed = await dataOf(
    await call("user", "POST", "id/upload-url", { contentType: "image/jpeg", byteSize: 1000 }, cookie),
  );
  const assetId = String(signed.data?.assetId);
  const asset = await MediaAsset.findById(assetId);
  cloud.remote.set(asset!.objectKey, { bytes: 1000, format: "jpg" });
  return assetId;
}

async function submit(cookie: string) {
  const frontAssetId = await upload(cookie);
  const backAssetId = await upload(cookie);
  const selfieAssetId = await upload(cookie);
  const done = await call(
    "user",
    "POST",
    "id/complete",
    { frontAssetId, backAssetId, selfieAssetId },
    cookie,
  );
  return { frontAssetId, backAssetId, selfieAssetId, done };
}

function expectPrivate(file: { url: string; expiresAt: string }) {
  const expiresAt = Date.parse(file.expiresAt);
  expect(file.url).toContain("expires_at=");
  expect(file.url).toContain("type=authenticated");
  expect(file.url.includes("res.cloudinary.com")).toBe(false);
  expect(file.url.includes("/image/upload/")).toBe(false);
  expect(expiresAt).toBeGreaterThan(Date.now());
  expect(expiresAt).toBeLessThanOrEqual(Date.now() + 120_000 + 2_000);
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  cloudEnv();
  await connectMemoryMongo();
});

afterAll(async () => {
  setCloudinaryClient(null);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_FOLDER_PREFIX;
  delete process.env.CSAM_PROVIDER;
  delete process.env.KYC_PROVIDER;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  cloudEnv();
  cloud = fakeCloud();
  setCloudinaryClient(cloud.client);
  await clearMemoryMongo();
});

describe("manual identity verification", () => {
  it("blocks an unverified user, accepts one pending submit, and allows a resubmit after rejection", async () => {
    const owner = await account("ada@example.com");
    const staff = await account("staff@example.com", ["trust_safety"]);
    await expect(assertVerified(owner.id)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });

    const first = await submit(owner.cookie);
    expect(first.done.status).toBe(200);
    expect((await dataOf(first.done)).data).toEqual({ status: "pending_review" });
    expect((await dataOf(await call("user", "GET", "status", undefined, owner.cookie))).data).toEqual({
      status: "pending_review",
    });

    const again = await submit(owner.cookie);
    expect(again.done.status).toBe(409);
    expect((await dataOf(again.done)).error?.code).toBe("CONFLICT");

    const openId = (await IdentityVerification.findOne({ userId: owner.id }))!._id.toString();
    const missingReason = await call("admin", "POST", `${openId}/decision`, { decision: "rejected" }, staff.cookie);
    expect(missingReason.status).toBe(400);
    expect((await dataOf(missingReason)).error?.code).toBe("VALIDATION_ERROR");
    expect(await AuditEvent.countDocuments({ action: "verification.decision" })).toBe(0);

    const pendingId = (await IdentityVerification.findOne({ userId: owner.id, status: "pending_review" }))!._id.toString();
    const rejected = await dataOf(
      await call("admin", "POST", `${pendingId}/decision`, { decision: "rejected", reason: "Photo is blurry" }, staff.cookie),
    );
    expect(rejected.data).toEqual({ status: "rejected" });
    const decision = await AuditEvent.findOne({ action: "verification.decision", targetId: pendingId });
    expect(decision?.actorId?.toString()).toBe(staff.id);
    expect(decision?.reason).toBe("Photo is blurry");
    expect(decision?.after).toMatchObject({ status: "rejected" });
    expect((await dataOf(await call("user", "GET", "status", undefined, owner.cookie))).data).toEqual({
      status: "rejected",
      reason: "Photo is blurry",
    });

    const second = await submit(owner.cookie);
    expect(second.done.status).toBe(200);
    const nextId = (await IdentityVerification.findOne({ userId: owner.id, status: "pending_review" }))!._id.toString();
    const approved = await dataOf(
      await call("admin", "POST", `${nextId}/decision`, { decision: "approved", reason: "Document matches" }, staff.cookie),
    );
    expect(approved.data).toEqual({ status: "approved" });
    expect(await AuditEvent.countDocuments({ action: "verification.decision", targetId: nextId })).toBe(1);
    await expect(assertVerified(owner.id)).resolves.toBeUndefined();
  });

  it("keeps the queue oldest-first and refuses role user on every admin route", async () => {
    const older = await account("ada@example.com");
    const newer = await account("bea@example.com");
    const member = await account("cam@example.com");
    const staff = await account("staff@example.com", ["moderator"]);
    await submit(older.cookie);
    await submit(newer.cookie);
    await IdentityVerification.updateOne({ userId: older.id }, { $set: { createdAt: new Date("2020-01-01T00:00:00.000Z") } });

    const queue = await dataOf(await call("admin", "GET", "", undefined, staff.cookie));
    expect(queue.data?.total).toBe(2);
    const items = queue.data?.items as { userId: string }[];
    expect(items.map((item) => item.userId)).toEqual([older.id, newer.id]);

    const id = (await IdentityVerification.findOne({ userId: older.id }))!._id.toString();
    for (const [method, path, body] of [
      ["GET", "", undefined],
      ["POST", `${id}/decision`, { decision: "approved", reason: "no" }],
      ["GET", `${id}/file`, undefined],
    ] as const) {
      const response = await call("admin", method, path, body, member.cookie);
      expect(response.status).toBe(403);
      expect((await dataOf(response)).error?.code).toBe("FORBIDDEN");
    }
  });

  it("signs a private staff URL, audits each view, and hides another user's submission", async () => {
    const owner = await account("ada@example.com");
    const other = await account("bea@example.com");
    const staff = await account("staff@example.com", ["admin"]);
    const { frontAssetId, backAssetId, selfieAssetId, done } = await submit(owner.cookie);
    const verificationId = (await IdentityVerification.findOne({ userId: owner.id }))!._id.toString();

    const stolen = await call(
      "user",
      "POST",
      "id/complete",
      { frontAssetId, backAssetId, selfieAssetId },
      other.cookie,
    );
    expect(stolen.status).toBe(403);
    expect((await dataOf(stolen)).error?.code).toBe("FORBIDDEN");
    const missingSelfie = await call("user", "POST", "id/complete", { frontAssetId, backAssetId }, other.cookie);
    expect(missingSelfie.status).toBe(400);
    expect((await dataOf(missingSelfie)).error?.code).toBe("VALIDATION_ERROR");
    expect((await dataOf(await call("user", "GET", "status", undefined, other.cookie))).data).toEqual({
      status: "unsubmitted",
    });
    expect(JSON.stringify((await dataOf(await call("user", "GET", "status", undefined, other.cookie))).data)).not.toContain(frontAssetId);
    expect((await dataOf(done)).data).toEqual({ status: "pending_review" });

    const first = await dataOf(await call("admin", "GET", `${verificationId}/file`, undefined, staff.cookie));
    const second = await dataOf(await call("admin", "GET", `${verificationId}/file`, undefined, staff.cookie));
    const files = first.data as {
      front: { url: string; expiresAt: string };
      back: { url: string; expiresAt: string };
      selfie: { url: string; expiresAt: string };
    };
    expectPrivate(files.front);
    expectPrivate(files.back);
    expectPrivate(files.selfie);
    expect(JSON.stringify(first.data).includes("res.cloudinary.com")).toBe(false);
    expect(String((second.data as { front: { url: string } }).front.url)).toContain("expires_at=");
    expect(await AuditEvent.countDocuments({ action: "verification.view", targetId: verificationId, actorId: staff.id })).toBe(2);

    const denied = await call("admin", "GET", `${verificationId}/file`, undefined, other.cookie);
    expect(denied.status).toBe(403);
  });

  it("rejects a selfie that reuses the front upload", async () => {
    const owner = await account("ada@example.com");
    const frontAssetId = await upload(owner.cookie);
    const backAssetId = await upload(owner.cookie);
    const same = await call(
      "user",
      "POST",
      "id/complete",
      { frontAssetId, backAssetId, selfieAssetId: frontAssetId },
      owner.cookie,
    );
    expect(same.status).toBe(400);
    expect((await dataOf(same)).error?.code).toBe("VALIDATION_ERROR");
    expect(await IdentityVerification.countDocuments({ userId: owner.id })).toBe(0);
  });
});
