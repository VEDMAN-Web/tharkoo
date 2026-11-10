import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as expireListings } from "@/app/api/cron/expire/route";
import { DELETE, GET, PATCH, POST } from "@/app/api/listings/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { AuditEvent, BannedWord, Category, Listing, Location, MediaAsset, Session, User } from "@/server/models";
import { randomToken } from "@/server/shared/crypto";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const phone = "9000000011";
const whatsapp = "9000000022";
const attestations = { adult: true, accurate: true, rights: true };

function call(method: string, pathname: string, body?: unknown, cookie?: string, headers?: Record<string, string>) {
  const requestHeaders = new Headers({ origin, ...headers });
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  if (cookie) requestHeaders.set("cookie", cookie);
  const request = new Request(`${origin}/api/listings${pathname ? `/${pathname}` : ""}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (method === "GET") return GET(request);
  if (method === "PATCH") return PATCH(request);
  if (method === "DELETE") return DELETE(request);
  return POST(request);
}

async function account(email: string, verificationStatus: "approved" | "unsubmitted" = "approved") {
  const token = randomToken();
  const user = await User.create({
    email,
    passwordHash: "not-a-secret",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date("2020-01-01"),
    roles: ["user"],
    verificationStatus,
    status: "active",
  });
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { user, cookie: `sid=${encodeURIComponent(token)}` };
}

async function catalogue(ownerId: mongoose.Types.ObjectId) {
  const category = await Category.create({ slug: "cycles", name: "Cycles", enabled: true, fields: [] });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
  const media = await MediaAsset.create({
    ownerId,
    kind: "image",
    objectKey: "listings/cycle",
    status: "cleared",
    clearedAt: new Date(),
    contentType: "image/jpeg",
  });
  return { category, city, media };
}

async function draftFor(cookie: string, categoryId: string, cityId: string, mediaId: string, title = "City cycle") {
  const created = await call("POST", "", { categoryId, cityId, title, description: "A city cycle for sale" }, cookie);
  expect(created.status).toBe(201);
  const id = (await created.json()).data.id as string;
  const details = await call(
    "PATCH",
    id,
    { stage: "details", contact: { phone, whatsapp, acceptForm: false } },
    cookie,
  );
  expect(details.status).toBe(200);
  const photos = await call("PATCH", id, { stage: "photos", mediaIds: [mediaId] }, cookie);
  expect(photos.status).toBe(200);
  return id;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});

afterAll(async () => {
  delete process.env.CONTACT_REVEAL_PER_HOUR;
  delete process.env.CRON_SECRET;
  delete process.env.FREE_ADS_PER_WEEK;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  delete process.env.CONTACT_REVEAL_PER_HOUR;
  delete process.env.FREE_ADS_PER_WEEK;
  await clearMemoryMongo();
});

describe("listing routes", () => {
  it("keeps another user's listing uneditable", async () => {
    const owner = await account("owner@example.com");
    const other = await account("other@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    expect((await call("PATCH", id, { stage: "basics", title: "Taken" }, other.cookie)).status).toBe(403);
    expect((await call("POST", `${id}/pause`, undefined, other.cookie)).status).toBe(403);
    expect((await call("DELETE", id, undefined, other.cookie)).status).toBe(403);
  });

  it("omits contact from the public listing and returns 410 after removal", async () => {
    const owner = await account("public@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await Listing.updateOne({ _id: id }, { $set: { status: "active", publishedAt: new Date() } });
    const listing = await Listing.findById(id);
    const published = await call("GET", listing?.slug ?? id);
    expect(published.status).toBe(200);
    const body = await published.json();
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(phone);
    expect(encoded).not.toContain(whatsapp);
    expect(encoded).not.toContain("telegram");
    expect((await call("DELETE", id, undefined, owner.cookie)).status).toBe(200);
    const gone = await call("GET", listing?.slug ?? id);
    expect(gone.status).toBe(410);
  });

  it("sends an active listing back to pending after a sensitive edit", async () => {
    const owner = await account("edit@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await Listing.updateOne({ _id: id }, { $set: { status: "active", publishedAt: new Date() } });
    const edited = await call("PATCH", id, { stage: "basics", title: "Updated cycle" }, owner.cookie);
    expect(edited.status).toBe(200);
    expect((await edited.json()).data.status).toBe("pending");
    const versions = await call("GET", `${id}/versions`, undefined, owner.cookie);
    expect((await versions.json()).data.versions.length).toBeGreaterThan(1);
  });

  it("enforces the weekly free listing limit", async () => {
    process.env.FREE_ADS_PER_WEEK = "1";
    const owner = await account("limit@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const first = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "First cycle");
    expect((await call("POST", `${first}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const second = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Second cycle");
    const blocked = await call("POST", `${second}/submit`, { attestations }, owner.cookie);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("FREE_LIMIT");
  });

  it("blocks publish until verification is approved and text is allowed", async () => {
    const owner = await account("review@example.com", "unsubmitted");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    const unverified = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(unverified.status).toBe(403);
    expect((await unverified.json()).error.code).toBe("VERIFICATION_REQUIRED");
    await User.updateOne({ _id: owner.user._id }, { $set: { verificationStatus: "approved" } });
    await BannedWord.create({ text: "zzzbannedtoken", matchType: "contains" });
    const banned = await call("PATCH", id, { stage: "basics", title: "A zzzbannedtoken cycle" }, owner.cookie);
    expect(banned.status).toBe(422);
    await Listing.updateOne({ _id: id }, { $set: { title: "A zzzbannedtoken cycle" } });
    const submitted = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(submitted.status).toBe(422);
    expect((await submitted.json()).error.code).toBe("POLICY_VIOLATION");
  });

  it("rejects an illegal transition and accepts pause, resume, renew, and duplicate", async () => {
    const owner = await account("state@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    expect((await call("POST", `${id}/pause`, undefined, owner.cookie)).status).toBe(409);
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await Listing.updateOne({ _id: id }, { $set: { status: "active", publishedAt: new Date() } });
    expect((await call("POST", `${id}/pause`, undefined, owner.cookie)).status).toBe(200);
    const resumed = await call("POST", `${id}/resume`, undefined, owner.cookie);
    expect((await resumed.json()).data.status).toBe("active");
    const renewed = await call("POST", `${id}/renew`, undefined, owner.cookie);
    expect(renewed.status).toBe(200);
    const copy = await call("POST", `${id}/duplicate`, undefined, owner.cookie);
    expect(copy.status).toBe(201);
    expect((await copy.json()).data.status).toBe("draft");
  });

  it("rate limits contact reveal and writes an audit event", async () => {
    process.env.CONTACT_REVEAL_PER_HOUR = "2";
    const owner = await account("reveal@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    await Listing.updateOne({ _id: id }, { $set: { status: "active", publishedAt: new Date() } });
    const first = await call("POST", `${id}/contact`, { channel: "phone" }, owner.cookie);
    expect(first.status).toBe(200);
    expect((await first.json()).data.value).toBe(phone);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await call("POST", `${id}/contact-reveal`, { channel: "whatsapp" }, owner.cookie)).status).toBe(200);
    const limited = await call("POST", `${id}/contact`, { channel: "phone" }, owner.cookie);
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");
    const events = await AuditEvent.find({ action: "listing.contact_reveal", targetId: id });
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain(phone);
  });

  it("requires the cron secret and expires an active listing once", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const owner = await account("cron@example.com");
    const { category, city } = await catalogue(owner.user._id);
    await Listing.create({
      ownerId: owner.user._id,
      status: "active",
      categoryId: category._id,
      cityId: city._id,
      title: "Old cycle",
      description: "Already live",
      expiresAt: new Date(Date.now() - 60_000),
      publishedAt: new Date(Date.now() - 86_400_000),
    });
    const denied = await expireListings(new Request(`${origin}/api/cron/expire`, { method: "POST", body: "{}" }));
    expect(denied.status).toBe(401);
    const headers = new Headers({ "x-cron-secret": "cron-test-secret", "content-type": "application/json" });
    const expired = await expireListings(new Request(`${origin}/api/cron/expire`, { method: "POST", headers, body: "{}" }));
    expect(expired.status).toBe(200);
    expect((await expired.json()).data.expired).toBe(1);
    const again = await expireListings(new Request(`${origin}/api/cron/expire`, { method: "POST", headers, body: "{}" }));
    expect((await again.json()).data.expired).toBe(0);
    expect(await Listing.countDocuments({ status: "expired" })).toBe(1);
  });
});
