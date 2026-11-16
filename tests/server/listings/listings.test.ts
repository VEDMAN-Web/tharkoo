import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => void revalidated.paths.push(path),
  revalidateTag: () => undefined,
}));
import { POST as expireListings } from "@/app/api/cron/expire/route";
import { DELETE, GET, PATCH, POST } from "@/app/api/listings/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { AuditEvent, BannedWord, Category, Listing, Location, MediaAsset, Session, Site, User } from "@/server/models";
import { randomToken } from "@/server/shared/crypto";
import { queryListings } from "@/server/search/query";
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
    expect((await call("PATCH", id, { stage: "basics", title: "Taken" }, other.cookie)).status).toBe(404);
    expect((await call("POST", `${id}/pause`, undefined, other.cookie)).status).toBe(404);
    expect((await call("DELETE", id, undefined, other.cookie)).status).toBe(404);
    expect((await call("POST", `${id}/submit`, { attestations }, other.cookie)).status).toBe(404);
    expect((await call("GET", `by-id/${id}`, undefined, other.cookie)).status).toBe(404);
    expect((await call("GET", `by-id/${id}`, undefined, owner.cookie)).status).toBe(200);
  });

  it("saves edits to a live ad on the same ad: same id and slug, no fee even with paid posting on, still live", async () => {
    const owner = await account("edit-live@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Blue city cycle");
    const first = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(first.status).toBe(200);
    const before = await Listing.findById(id);
    expect(before?.status).toBe("active");
    const slug = before?.slug;
    const expiresAt = before?.expiresAt?.getTime();
    expect(slug).toBeTruthy();

    await Site.updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: 30 } }, { upsert: true, strict: false });
    const changed = await call("PATCH", id, { stage: "basics", title: "Red city cycle, new title" }, owner.cookie);
    expect(changed.status).toBe(200);
    const saved = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(saved.status).toBe(200);
    const body = (await saved.json()).data;
    expect(body.status).toBe("active");
    expect(body.charged).toBe(0);
    const after = await Listing.findById(id);
    expect(String(after?._id)).toBe(id);
    expect(after?.slug).toBe(slug);
    expect(after?.title).toBe("Red city cycle, new title");
    expect(after?.status).toBe("active");
    expect(after?.expiresAt?.getTime()).toBe(expiresAt);

    const again = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(again.status).toBe(200);
    expect((await again.json()).data.charged).toBe(0);
  });

  it("keeps a live ad live and indexed while its owner edits it: the new title shows after one step", async () => {
    const owner = await account("edit-stays-live@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Live cycle");
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const slug = (await Listing.findById(id))?.slug ?? "";
    const changed = await call("PATCH", id, { stage: "basics", title: "Live cycle with a new title" }, owner.cookie);
    expect(changed.status).toBe(200);
    const after = await Listing.findById(id);
    expect(after?.status).toBe("active");
    expect(after?.seoNoindex).toBe(false);
    expect(after?.slug).toBe(slug);
    const publicView = await call("GET", slug);
    expect(publicView.status).toBe(200);
    expect((await publicView.json()).data.title).toBe("Live cycle with a new title");
  });

  it("refuses an edit with a forbidden word on a live ad and leaves it unchanged and live", async () => {
    const owner = await account("edit-forbidden@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Clean cycle");
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await BannedWord.create({ text: "zzzliveword", matchType: "contains" });
    const refused = await call("PATCH", id, { stage: "basics", title: "Cycle zzzliveword here" }, owner.cookie);
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.status).toBeLessThan(500);
    const text = JSON.stringify(await refused.json());
    expect(text).toContain("Listing text is not allowed");
    const after = await Listing.findById(id);
    expect(after?.title).toBe("Clean cycle");
    expect(after?.status).toBe("active");
    expect(after?.seoNoindex).toBe(false);
    const details = await call("PATCH", id, { stage: "details", contact: { phone, whatsapp: "zzzliveword", acceptForm: false } }, owner.cookie);
    expect(details.status).toBeGreaterThanOrEqual(400);
    expect((await Listing.findById(id).select("+contact"))?.contact?.whatsapp).toBe(whatsapp);
  });

  it("refuses a contact change that leaves a live ad with no way to reach it", async () => {
    const owner = await account("edit-nocontact@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Reachable cycle");
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const none = await call("PATCH", id, { stage: "details", contact: { acceptForm: false } }, owner.cookie);
    expect(none.status).toBeGreaterThanOrEqual(400);
    expect(none.status).toBeLessThan(500);
    const after = await Listing.findById(id).select("+contact");
    expect(after?.status).toBe("active");
    expect(after?.contact?.phone).toBe(phone);
  });

  it("shows a new photo on a live ad only once it is cleared", async () => {
    const owner = await account("edit-photos@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Photo cycle");
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await MediaAsset.updateOne({ _id: media._id }, { $set: { objectKey: "/uploads/first-cleared.jpg" } });
    const scanning = await MediaAsset.create({
      ownerId: owner.user._id,
      kind: "image",
      objectKey: "/uploads/scanning-new.jpg",
      status: "scanning",
      contentType: "image/jpeg",
    });
    const attach = await call("PATCH", id, { stage: "photos", mediaIds: [media._id.toString(), scanning._id.toString()] }, owner.cookie);
    expect(attach.status).toBe(200);
    expect((await Listing.findById(id))?.status).toBe("active");
    const listing = await Listing.findById(id);
    const found = (await queryListings({ pageSize: 20 })).hits.find((row) => row.slug === listing?.slug);
    expect(found).toBeTruthy();
    expect(found?.photos).toEqual(["/uploads/first-cleared.jpg"]);
    await MediaAsset.updateOne({ _id: scanning._id }, { $set: { status: "cleared", clearedAt: new Date() } });
    const later = (await queryListings({ pageSize: 20 })).hits.find((row) => row.slug === listing?.slug);
    expect(later?.photos).toEqual(["/uploads/first-cleared.jpg", "/uploads/scanning-new.jpg"]);
  });

  it("keeps a paused ad paused when its edits are saved, with no fee", async () => {
    const owner = await account("edit-paused@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Paused cycle");
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const slug = (await Listing.findById(id))?.slug;
    expect((await call("POST", `${id}/pause`, undefined, owner.cookie)).status).toBe(200);
    await Site.updateOne({ key: "default" }, { $set: { paidPostingOn: true, postingFeeCredits: 30 } }, { upsert: true, strict: false });
    expect((await call("PATCH", id, { stage: "details", price: 1200 }, owner.cookie)).status).toBe(200);
    const saved = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(saved.status).toBe(200);
    const body = (await saved.json()).data;
    expect(body.status).toBe("paused");
    expect(body.charged).toBe(0);
    const after = await Listing.findById(id);
    expect(after?.status).toBe("paused");
    expect(after?.slug).toBe(slug);
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

  it("refreshes the home, category, city and ad pages when an ad is published", async () => {
    const owner = await account("fresh@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    revalidated.paths.length = 0;
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const slug = (await Listing.findById(id))?.slug;
    expect(slug).toBeTruthy();
    expect(revalidated.paths).toEqual(expect.arrayContaining(["/", "/cycles/", "/cycles/pune/", `/ad/${slug}/`]));
  });

  it("keeps an active listing active after a sensitive edit and records a version", async () => {
    const owner = await account("edit@example.com");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString());
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    await Listing.updateOne({ _id: id }, { $set: { status: "active", publishedAt: new Date() } });
    const edited = await call("PATCH", id, { stage: "basics", title: "Updated cycle" }, owner.cookie);
    expect(edited.status).toBe(200);
    expect((await edited.json()).data.status).toBe("active");
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
    // The ID check is asked for only when the switch is on (H6.14). The default is off.
    await Site.updateOne({ key: "default" }, { $set: { requireIdCheckToPost: true } }, { upsert: true });
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

  it("publishes for an unsubmitted adult while the ID-check switch is off, and marks no one approved (H6.14)", async () => {
    const owner = await account("switch-off@example.com", "unsubmitted");
    const { category, city, media } = await catalogue(owner.user._id);
    const id = await draftFor(owner.cookie, category._id.toString(), city._id.toString(), media._id.toString(), "Switch off ad");
    const submitted = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(submitted.status).toBe(200);
    expect((await submitted.json()).data.status).toBe("active");
    const after = await User.findById(owner.user._id).lean();
    expect(after?.verificationStatus).toBe("unsubmitted");
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
