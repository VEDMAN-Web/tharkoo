import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/shared/policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/shared/policy")>()),
  textDenied: (text: string) => ({ denied: /blockedword/i.test(text) }),
}));

import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { closeAccount, editProfile, editVendor, removeVerifiedBadge } from "@/server/admin/user-profile";
import { getUserDetail, listUsers, parseUserQuery } from "@/server/admin/users";
import { PhoneIdentity } from "@/server/auth/phone";
import { creditWallet } from "@/server/billing/ledger";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Listing, Session, SiteMedia, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const trust: AdminCtx = { actorId: "000000000000000000000021", email: "trust@example.com", roles: ["trust_safety"], requestId: "r-t" };
const support: AdminCtx = { actorId: "000000000000000000000022", email: "support@example.com", roles: ["support"], requestId: "r-s" };
const moderator: AdminCtx = { actorId: "000000000000000000000023", email: "mod@example.com", roles: ["moderator"], requestId: "r-m" };
const admin: AdminCtx = { actorId: "000000000000000000000024", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };

let counter = 0;
async function person(extra: Record<string, unknown> = {}) {
  return User.create({ email: `u${++counter}@example.com`, passwordHash: "x", displayName: "Rohan Mehta", roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01"), ...extra });
}
async function seller(extra: Record<string, unknown> = {}) {
  return person({ sellerProfile: { name: "Rohan Mehta", city: "Pune", whatsapp: "+919800000001", availableNow: false, completedAt: new Date() }, ...extra });
}
async function ad(ownerId: unknown, title: string, status: string) {
  const row = await Listing.collection.insertOne({ ownerId, title, status, slug: `${title.toLowerCase().replace(/\W+/g, "-")}-${Math.floor(Math.random() * 1e6)}`, createdAt: new Date() });
  return String(row.insertedId);
}
const picture = async (extra: Record<string, unknown> = {}) =>
  String((await SiteMedia.create({ url: `/uploads/${new mongoose.Types.ObjectId()}.png`, objectKey: `k-${Math.random()}`, alt: "Portrait", width: 400, height: 400, bytes: 900, contentType: "image/png", tags: [], uploadedBy: "a@example.com", ...extra }))._id);
const phoneOf = async (id: unknown) => (await PhoneIdentity.findOne({ userId: id as mongoose.Types.ObjectId }).lean<{ phone: string } | null>())?.phone ?? null;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
  await PhoneIdentity.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("edit profile", () => {
  it("changes the name, the city and the phone number, keeps the email, audits it, and one undo puts all back (a second undo is refused)", async () => {
    const user = await seller();
    await PhoneIdentity.create({ userId: user._id, phone: "+919800000099" });
    const done = await editProfile(support, { userId: String(user._id), name: "  Rohan  M ", city: "Mumbai", phone: "98765 43210", reason: "Asked by phone" });
    const after = await User.findById(user._id).lean();
    expect(after).toMatchObject({ displayName: "Rohan M", email: user.email });
    expect(after?.sellerProfile).toMatchObject({ name: "Rohan M", city: "Mumbai" });
    expect(await phoneOf(user._id)).toBe("+919876543210");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "user.profile", targetType: "user", actorRole: "support", reason: "Asked by phone" });
    expect(row?.undo?.kind).toBe("user.edit");
    expect(JSON.stringify(row)).not.toContain(user.email);
    expect(await undoEvent(support, done.eventId)).toMatchObject({ ok: true });
    const back = await User.findById(user._id).lean();
    expect(back?.displayName).toBe("Rohan Mehta");
    expect(back?.sellerProfile).toMatchObject({ name: "Rohan Mehta", city: "Pune" });
    expect(await phoneOf(user._id)).toBe("+919800000099");
    expect(await undoEvent(support, done.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("adds a first phone number, removes it again on undo, and refuses a number on another account, a bad number and an empty change", async () => {
    const user = await person();
    const other = await person();
    await PhoneIdentity.create({ userId: other._id, phone: "+919811111111" });
    const added = await editProfile(admin, { userId: String(user._id), name: "Rohan Mehta", phone: "9822222222" });
    expect(await phoneOf(user._id)).toBe("+919822222222");
    await undoEvent(admin, added.eventId);
    expect(await phoneOf(user._id)).toBeNull();
    await expect(editProfile(admin, { userId: String(user._id), name: "Rohan Mehta", phone: "9811111111" })).rejects.toBeInstanceOf(ConflictError);
    await expect(editProfile(admin, { userId: String(user._id), name: "Rohan Mehta", phone: "12ab" })).rejects.toBeInstanceOf(ValidationError);
    await expect(editProfile(admin, { userId: String(user._id), name: "Rohan Mehta" })).rejects.toBeInstanceOf(ConflictError);
    await expect(editProfile(admin, { userId: String(user._id), name: "R" })).rejects.toBeInstanceOf(ValidationError);
    await expect(editProfile(admin, { userId: String(user._id), name: "Rohan", city: "Delhi" })).rejects.toBeInstanceOf(ValidationError);
    await expect(editProfile(admin, { userId: String(user._id), name: "blockedword here" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("is for support, trust and safety and admins; not for a moderator, staff accounts or a closed account; undo is refused after another change", async () => {
    const user = await seller();
    await expect(editProfile(moderator, { userId: String(user._id), name: "New Name", city: "Pune" })).rejects.toBeInstanceOf(ForbiddenError);
    const staff = await person({ roles: ["support"] });
    await expect(editProfile(admin, { userId: String(staff._id), name: "New Name" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editProfile(admin, { userId: String(new mongoose.Types.ObjectId()), name: "New Name" })).rejects.toBeInstanceOf(NotFoundError);
    const first = await editProfile(support, { userId: String(user._id), name: "First Name", city: "Pune" });
    await editProfile(trust, { userId: String(user._id), name: "Second Name", city: "Pune" });
    expect(await undoEvent(support, first.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    await User.updateOne({ _id: user._id }, { $set: { status: "deleted" } });
    await expect(editProfile(admin, { userId: String(user._id), name: "Third Name", city: "Pune" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("vendor profile", () => {
  it("saves the about text, WhatsApp number and picture, hides the vendor with a reason, and undo puts each back", async () => {
    const user = await seller();
    const photo = await picture();
    const saved = await editVendor(support, { userId: String(user._id), about: "Home tuition in Pune since 2019.", whatsapp: "+91 98000 00002", photoMediaId: photo, hidden: false });
    const after = await User.findById(user._id).lean();
    expect(after?.sellerProfile).toMatchObject({ about: "Home tuition in Pune since 2019.", whatsapp: "+919800000002" });
    expect(String(after?.sellerProfile?.photoMediaId)).toBe(photo);
    await expect(editVendor(support, { userId: String(user._id), about: "Home tuition in Pune since 2019.", whatsapp: "+919800000002", photoMediaId: photo, hidden: true })).rejects.toBeInstanceOf(ValidationError);
    const hid = await editVendor(support, { userId: String(user._id), about: "Home tuition in Pune since 2019.", whatsapp: "+919800000002", photoMediaId: photo, hidden: true, reason: "Complaints, under review" });
    expect((await User.findById(user._id).lean())?.sellerProfile?.hidden).toBe(true);
    expect(await undoEvent(support, hid.eventId)).toMatchObject({ ok: true });
    expect((await User.findById(user._id).lean())?.sellerProfile?.hidden ?? null).toBeNull();
    expect(await undoEvent(moderator, saved.eventId)).toMatchObject({ ok: false, reason: "not_allowed" });
    await undoEvent(admin, saved.eventId);
    const back = await User.findById(user._id).lean();
    expect(back?.sellerProfile?.about ?? null).toBeNull();
    expect(back?.sellerProfile?.photoMediaId ?? null).toBeNull();
    expect(back?.sellerProfile?.whatsapp).toBe("+919800000001");
  });

  it("refuses a picture that is not in the library or is in the Trash, a bad WhatsApp number, a long text, and a person who is not a seller", async () => {
    const user = await seller();
    const trashed = await picture({ trashedAt: new Date() });
    await expect(editVendor(admin, { userId: String(user._id), photoMediaId: trashed })).rejects.toBeInstanceOf(ValidationError);
    await expect(editVendor(admin, { userId: String(user._id), photoMediaId: "nope" })).rejects.toBeInstanceOf(ValidationError);
    await expect(editVendor(admin, { userId: String(user._id), whatsapp: "12" })).rejects.toBeInstanceOf(ValidationError);
    await expect(editVendor(admin, { userId: String(user._id), about: "x".repeat(501) })).rejects.toBeInstanceOf(ValidationError);
    await expect(editVendor(admin, { userId: String(user._id), about: "blockedword" })).rejects.toBeInstanceOf(ValidationError);
    const plain = await person();
    await expect(editVendor(admin, { userId: String(plain._id), about: "Hello" })).rejects.toBeInstanceOf(ConflictError);
    await expect(editVendor(moderator, { userId: String(user._id), about: "Hello" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("the verified badge", () => {
  it("is removed with a reason, the ID documents are not touched, and undo gives it back", async () => {
    const user = await person({ verificationStatus: "approved" });
    await expect(removeVerifiedBadge(trust, { userId: String(user._id), reason: "" })).rejects.toBeInstanceOf(ValidationError);
    const done = await removeVerifiedBadge(trust, { userId: String(user._id), reason: "Photo no longer matches" });
    expect((await User.findById(user._id).lean())?.verificationStatus).toBe("unsubmitted");
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "user.badge_remove", reason: "Photo no longer matches" });
    const days = Math.round((new Date(row!.undo!.until).getTime() - new Date(row!.createdAt!).getTime()) / 86_400_000);
    expect(days).toBe(7);
    await expect(removeVerifiedBadge(trust, { userId: String(user._id), reason: "again" })).rejects.toBeInstanceOf(ConflictError);
    expect(await undoEvent(trust, done.eventId)).toMatchObject({ ok: true });
    expect((await User.findById(user._id).lean())?.verificationStatus).toBe("approved");
  });

  it("is for people who decide ID checks, not for support", async () => {
    const user = await person({ verificationStatus: "approved" });
    await expect(removeVerifiedBadge(support, { userId: String(user._id), reason: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await User.findById(user._id).lean())?.verificationStatus).toBe("approved");
  });
});

describe("close account", () => {
  it("needs the typed word and a reason, hides live ads only, ends every sign-in, deletes nothing, and undo brings back the account and those ads", async () => {
    const user = await seller();
    const live = await ad(user._id, "Live one", "active");
    const paused = await ad(user._id, "Paused by seller", "paused");
    await Session.collection.insertMany([{ userId: user._id, tokenHash: "s1", expiresAt: new Date(Date.now() + 1e7), createdAt: new Date() }]);
    await expect(closeAccount(trust, { userId: String(user._id), reason: "Request", confirm: "close it" })).rejects.toBeInstanceOf(ValidationError);
    await expect(closeAccount(trust, { userId: String(user._id), reason: "", confirm: "CLOSE" })).rejects.toBeInstanceOf(ValidationError);
    const done = await closeAccount(trust, { userId: String(user._id), reason: "The user asked us to close it", confirm: "CLOSE" });
    expect((await User.findById(user._id).lean())?.status).toBe("deleted");
    expect((await Listing.findById(live).lean())?.status).toBe("paused");
    expect((await Listing.findById(paused).lean())?.status).toBe("paused");
    expect(await Session.countDocuments({ userId: user._id, revokedAt: { $exists: false } })).toBe(0);
    expect(await User.countDocuments({ _id: user._id })).toBe(1);
    expect(done.summary).toContain("Closed");
    await expect(closeAccount(trust, { userId: String(user._id), reason: "again", confirm: "CLOSE" })).rejects.toBeInstanceOf(ConflictError);
    expect(await undoEvent(trust, done.eventId)).toMatchObject({ ok: true });
    expect((await User.findById(user._id).lean())?.status).toBe("active");
    expect((await Listing.findById(live).lean())?.status).toBe("active");
    expect((await Listing.findById(paused).lean())?.status).toBe("paused");
    expect(await Session.countDocuments({ userId: user._id, revokedAt: { $exists: false } })).toBe(0);
  });

  it("is for the people who can ban, never for staff accounts or yourself, and redo of the undo closes it again", async () => {
    const user = await seller();
    const live = await ad(user._id, "Live one", "active");
    await expect(closeAccount(support, { userId: String(user._id), reason: "x", confirm: "CLOSE" })).rejects.toBeInstanceOf(ForbiddenError);
    const staff = await person({ roles: ["moderator"] });
    await expect(closeAccount(admin, { userId: String(staff._id), reason: "x", confirm: "CLOSE" })).rejects.toBeInstanceOf(ForbiddenError);
    const self = await person();
    await expect(closeAccount({ ...admin, actorId: String(self._id) }, { userId: String(self._id), reason: "x", confirm: "CLOSE" })).rejects.toBeInstanceOf(ForbiddenError);
    const done = await closeAccount(admin, { userId: String(user._id), reason: "Fraud", confirm: "CLOSE" });
    const undone = await undoEvent(admin, done.eventId);
    if (!undone.ok) throw new Error("undo failed");
    expect(await undoEvent(admin, undone.eventId)).toMatchObject({ ok: true });
    expect((await User.findById(user._id).lean())?.status).toBe("deleted");
    expect((await Listing.findById(live).lean())?.status).toBe("paused");
  });

  it("a banned account can be closed and undo puts it back as banned", async () => {
    const user = await person({ status: "suspended" });
    const done = await closeAccount(admin, { userId: String(user._id), reason: "Fraud", confirm: "CLOSE" });
    await undoEvent(admin, done.eventId);
    expect((await User.findById(user._id).lean())?.status).toBe("suspended");
  });
});

describe("the user list filters and the drawer data", () => {
  it("shows only people with live ads, only people with credits, or both, with a search", async () => {
    const a = await seller({ displayName: "Asha Rao" });
    const b = await seller({ displayName: "Bina Das" });
    const c = await person({ displayName: "Chitra Nair" });
    await ad(a._id, "Live", "active");
    await ad(b._id, "Old", "paused");
    await creditWallet({ userId: String(b._id), amount: 50, refType: "pack", refId: "p1", requestId: "r", once: true });
    await creditWallet({ userId: String(c._id), amount: 10, refType: "pack", refId: "p2", requestId: "r", once: true });
    const names = async (params: Record<string, string>) => (await listUsers(parseUserQuery(params), ["admin"])).rows.map((row) => row.name).sort();
    expect(await names({})).toEqual(["Asha Rao", "Bina Das", "Chitra Nair"]);
    expect(await names({ ads: "1" })).toEqual(["Asha Rao"]);
    expect(await names({ credits: "1" })).toEqual(["Bina Das", "Chitra Nair"]);
    expect(await names({ ads: "1", credits: "1" })).toEqual([]);
    expect(await names({ credits: "1", q: "Chi" })).toEqual(["Chitra Nair"]);
    expect(await names({ credits: "1", q: "Asha" })).toEqual([]);
    expect(parseUserQuery({ ads: "1" })).toMatchObject({ ads: true, credits: false });
  });

  it("gives a vendor its profile, picture and earnings (for people who may see money), and nothing for a plain user", async () => {
    const photo = await picture();
    const user = await seller({ sellerProfile: { name: "Rohan Mehta", city: "Pune", whatsapp: "+919800000001", availableNow: true, completedAt: new Date(), about: "Tutor", photoMediaId: photo, hidden: true } });
    const plain = await person();
    const asSupport = await getUserDetail(String(user._id), ["support"]);
    expect(asSupport.vendor).toMatchObject({ about: "Tutor", hidden: true, availableNow: true, earnings: null });
    expect(asSupport.vendor?.photo?.id).toBe(photo);
    const asFinance = await getUserDetail(String(user._id), ["support", "finance"]);
    expect(asFinance.vendor?.earnings).toEqual({ balance: 0, requested: 0, paid: 0 });
    expect((await getUserDetail(String(plain._id), ["support"])).vendor).toBeNull();
    expect(JSON.stringify(asFinance)).not.toMatch(/documentRef|passwordHash/);
  });
});
