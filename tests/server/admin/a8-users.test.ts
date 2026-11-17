import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classifySearch, getUserDetail, listUsers, parseUserQuery, type UserQuery } from "@/server/admin/users";
import { PhoneIdentity } from "@/server/auth/phone";
import { AuditEvent, Listing, Session, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ADMIN = ["admin"];
const SUPPORT = ["support"];

const query = (over: Partial<UserQuery> = {}): UserQuery => ({ tab: "all", q: "", page: 1, pageSize: 25, ...over });

async function person(email: string, name: string, extra: Record<string, unknown> = {}) {
  return User.create({ email, passwordHash: "x", displayName: name, roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01"), ...extra });
}

async function seed() {
  const asha = await person("asha@example.com", "Asha Rao", { sellerProfile: { name: "Asha", city: "Surat", availableNow: false, completedAt: new Date() } });
  const bilal = await person("bilal@example.com", "Bilal Khan", { verificationStatus: "pending_review" });
  const chitra = await person("chitra@example.com", "Chitra Das", { status: "suspended" });
  const staff = await person("support@example.com", "Sana Support", { roles: ["support"] });
  const gone = await person("gone@example.com", "Gone Person", { status: "deleted" });
  await PhoneIdentity.create({ userId: asha._id, phone: "+919876543210" });
  const ad = await Listing.collection.insertOne({ ownerId: asha._id, title: "Study table", status: "active", slug: "study-table-abc123", createdAt: new Date() });
  await Listing.collection.insertOne({ ownerId: asha._id, title: "A draft", status: "draft", createdAt: new Date() });
  await Session.collection.insertOne({ userId: asha._id, tokenHash: "t1", expiresAt: new Date(Date.now() + 1e6), createdAt: new Date("2026-11-10T10:00:00Z") });
  await Session.collection.insertOne({ userId: asha._id, tokenHash: "t2", expiresAt: new Date(Date.now() + 1e6), createdAt: new Date("2026-11-14T10:00:00Z") });
  await SupportTicket.collection.insertOne({ number: 7, ownerId: asha._id, ownerKind: "vendor", topic: "something_else", subject: "Photo problem", status: "open", lastMessageAt: new Date("2026-11-15T09:00:00Z"), createdAt: new Date() });
  await AuditEvent.collection.insertOne({ actorType: "admin", action: "user.note", targetType: "user", targetId: String(asha._id), requestId: "r1", summary: "Noted: calls on WhatsApp", actorRole: "support", createdAt: new Date("2026-11-12T10:00:00Z") });
  await WalletEntry.collection.insertOne({ userId: asha._id, delta: 70, reason: "credit", refType: "payment", refId: "p1", balanceAfter: 70, idempotencyKey: "k-a8-1", createdAt: new Date() });
  return { asha, bilal, chitra, staff, gone, adId: String(ad.insertedId) };
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
});

describe("parsing the address", () => {
  it("falls back to the first tab, page 1 and 25 rows", () => {
    expect(parseUserQuery({})).toEqual({ tab: "all", q: "", page: 1, pageSize: 25, ads: false, credits: false });
    expect(parseUserQuery({ tab: "banned", q: " asha ", page: "3", size: "50" })).toEqual({ tab: "banned", q: "asha", page: 3, pageSize: 50, ads: false, credits: false });
    expect(parseUserQuery({ tab: "nope", page: "-4", size: "13" })).toEqual({ tab: "all", q: "", page: 1, pageSize: 25, ads: false, credits: false });
  });

  it("tells email, phone, ad id and name apart", () => {
    expect(classifySearch("Asha@Example.com")).toEqual({ kind: "email", value: "asha@example.com" });
    expect(classifySearch("98765 43210").kind).toBe("phone");
    expect(classifySearch("+91 98765 43210").kind).toBe("phone");
    expect(classifySearch("0123456789abcdef01234567").kind).toBe("ad");
    expect(classifySearch("demo-0042").kind).toBe("ad");
    expect(classifySearch("Asha").kind).toBe("name");
    expect(classifySearch("   ").kind).toBe("empty");
  });
});

describe("the user list", () => {
  it("lists real users newest first, without deleted accounts, with ad counts and last sign in", async () => {
    const data = await seed();
    const list = await listUsers(query(), ADMIN);
    expect(list.total).toBe(4);
    expect(list.rows.map((row) => row.email)).not.toContain("gone@example.com");
    const asha = list.rows.find((row) => row.id === String(data.asha._id))!;
    expect(asha.ads).toBe(1);
    expect(asha.city).toBe("Surat");
    expect(asha.lastSeen).toBe("2026-11-14T10:00:00.000Z");
    expect(list.rows.find((row) => row.id === String(data.bilal._id))!.lastSeen).toBeNull();
    expect(list.counts).toEqual({ all: 4, sellers: 1, id: 1, banned: 1, staff: 1 });
  });

  it("filters the tabs: sellers, ID pending, banned and staff only staff roles", async () => {
    await seed();
    expect((await listUsers(query({ tab: "sellers" }), ADMIN)).rows.map((row) => row.email)).toEqual(["asha@example.com"]);
    expect((await listUsers(query({ tab: "id" }), ADMIN)).rows.map((row) => row.email)).toEqual(["bilal@example.com"]);
    expect((await listUsers(query({ tab: "banned" }), ADMIN)).rows.map((row) => row.email)).toEqual(["chitra@example.com"]);
    const staff = await listUsers(query({ tab: "staff" }), ADMIN);
    expect(staff.rows.map((row) => row.email)).toEqual(["support@example.com"]);
    expect(staff.rows.every((row) => row.roles.some((role) => role !== "user"))).toBe(true);
  });

  it("finds a user by exact email, by phone in any common form, by ad id or ad address, and by the start of a name", async () => {
    const data = await seed();
    const idOf = async (q: string, tab: UserQuery["tab"] = "all") => (await listUsers(query({ q, tab }), ADMIN)).rows.map((row) => row.id);
    const asha = String(data.asha._id);
    expect(await idOf("asha@example.com")).toEqual([asha]);
    expect(await idOf("ASHA@example.com")).toEqual([asha]);
    expect(await idOf("asha@exampl")).toEqual([]);
    expect(await idOf("9876543210")).toEqual([asha]);
    expect(await idOf("+91 98765 43210")).toEqual([asha]);
    expect(await idOf("+919876543210")).toEqual([asha]);
    expect(await idOf("9000000000")).toEqual([]);
    expect(await idOf(data.adId)).toEqual([asha]);
    expect(await idOf("study-table-abc123")).toEqual([]);
    expect(await idOf("Chi")).toEqual([String(data.chitra._id)]);
    expect(await idOf("hitra")).toEqual([]);
    expect(await idOf("C")).toEqual([]);
    expect(await idOf("Asha", "banned")).toEqual([]);
  });

  it("treats regex characters in a name search as plain text", async () => {
    await seed();
    expect((await listUsers(query({ q: ".*" }), ADMIN)).rows).toEqual([]);
    expect((await listUsers(query({ q: "(Asha" }), ADMIN)).rows).toEqual([]);
  });

  it("pages the rows and says how many there are", async () => {
    await seed();
    const first = await listUsers(query({ pageSize: 25 }), ADMIN);
    expect(first.rows).toHaveLength(4);
    const second = await listUsers(query({ page: 2, pageSize: 25 }), ADMIN);
    expect(second.rows).toHaveLength(0);
    expect(second.total).toBe(4);
  });
});

describe("who may open it", () => {
  it("lets support, moderators, trust and safety and admins read, and refuses the other staff roles", async () => {
    await seed();
    for (const role of ["support", "moderator", "trust_safety", "admin", "superadmin"]) await expect(listUsers(query(), [role])).resolves.toBeTruthy();
    for (const role of ["finance", "seo_editor", "blog_editor", "user"]) await expect(listUsers(query(), [role])).rejects.toThrow();
    await expect(getUserDetail("0123456789abcdef01234567", ["finance"])).rejects.toThrow();
  });

  it("gives support the same read only detail", async () => {
    const data = await seed();
    const detail = await getUserDetail(String(data.asha._id), SUPPORT);
    expect(detail.user.name).toBe("Asha Rao");
    expect(Object.keys(detail).sort()).toEqual(["ads", "balance", "history", "tickets", "user", "vendor"]);
  });
});

describe("the drawer", () => {
  it("shows the profile, phone, ads, balance, tickets and the last changes", async () => {
    const data = await seed();
    const detail = await getUserDetail(String(data.asha._id), ADMIN);
    expect(detail.user.phone).toBe("+919876543210");
    expect(detail.user.seller).toBe(true);
    expect(detail.ads.map((ad) => ad.title).sort()).toEqual(["A draft", "Study table"]);
    expect(detail.balance).toBe(70);
    expect(detail.tickets).toEqual([expect.objectContaining({ number: 7, subject: "Photo problem", status: "open" })]);
    expect(detail.history).toEqual([expect.objectContaining({ summary: "Noted: calls on WhatsApp", actorRole: "support" })]);
  });

  it("answers not found for an unknown or malformed id", async () => {
    await seed();
    await expect(getUserDetail("not-an-id", ADMIN)).rejects.toThrow("Not found");
    await expect(getUserDetail("0123456789abcdef01234567", ADMIN)).rejects.toThrow("Not found");
  });
});
