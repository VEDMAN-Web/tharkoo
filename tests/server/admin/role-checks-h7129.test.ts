import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  cookies: async () => ({ get: (name: string) => (name === "sid" && session.token ? { name, value: session.token } : undefined) }),
}));

import { readAdCountsAction } from "@/app/admin/ads/[id]/actions";
import { searchHomeAdsAction } from "@/app/admin/ads/home-actions";
import { hashToken } from "@/server/auth/http";
import { ForbiddenError } from "@/server/http";
import { IdentityVerification, Listing, Session, User } from "@/server/models";
import { decideVerification } from "@/server/verification/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  delete process.env.KYC_PROVIDER;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  session.token = undefined;
  await clearMemoryMongo();
});

async function account(email: string, roles: string[]) {
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
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), token };
}

async function pendingFor(userId: string) {
  const row = await IdentityVerification.create({
    userId,
    status: "pending_review",
    dateOfBirthAsserted: new Date("1995-04-02"),
    documentRef: "front",
    documents: { front: "front", selfie: "selfie" },
  });
  return row._id.toString();
}

describe("readAdCountsAction", () => {
  it("refuses a visitor and a normal user, and allows an admin", async () => {
    const member = await account("member@example.com", ["user"]);
    const admin = await account("admin@example.com", ["admin"]);
    const listing = await Listing.create({ ownerId: member.id, categoryId: new mongoose.Types.ObjectId(), cityId: new mongoose.Types.ObjectId(), title: "Desk", description: "A desk", status: "active" });
    const id = listing._id.toString();
    expect(await readAdCountsAction(id)).toMatchObject({ ok: false });
    session.token = member.token;
    expect(await readAdCountsAction(id)).toMatchObject({ ok: false });
    session.token = admin.token;
    expect(await readAdCountsAction(id)).toMatchObject({ ok: true });
  });
});

describe("searchHomeAdsAction", () => {
  it("refuses a visitor and a normal user, and allows an admin", async () => {
    const member = await account("member2@example.com", ["user"]);
    const admin = await account("admin2@example.com", ["superadmin"]);
    expect(await searchHomeAdsAction("desk")).toMatchObject({ ok: false });
    session.token = member.token;
    expect(await searchHomeAdsAction("desk")).toMatchObject({ ok: false });
    session.token = admin.token;
    expect(await searchHomeAdsAction("desk")).toMatchObject({ ok: true });
  });
});

describe("decideVerification", () => {
  it("refuses a normal user and an empty role list inside the service, and decides for staff", async () => {
    const owner = await account("owner@example.com", ["user"]);
    const staff = await account("staff@example.com", ["moderator"]);
    const id = await pendingFor(owner.id);
    await expect(decideVerification(owner.id, ["user"], id, "approved", "ok", "req")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decideVerification(owner.id, [], id, "approved", "ok", "req")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await IdentityVerification.findById(id))?.status).toBe("pending_review");
    expect(await decideVerification(staff.id, ["moderator"], id, "approved", "Document matches", "req")).toEqual({ status: "approved" });
    expect((await User.findById(owner.id))?.verificationStatus).toBe("approved");
  });
});
