import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
import { GET, PATCH, POST } from "@/app/api/listings/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { listDraftMedia } from "@/server/media/mine";
import { Category, Listing, Location, MediaAsset, Session, User } from "@/server/models";
import { randomToken } from "@/server/shared/crypto";
import { INTEREST_MAX, parseSavedAttributes, validInterests } from "@/server/shared/fields";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const attestations = { adult: true, accurate: true, rights: true };

function call(method: string, pathname: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const request = new Request(`${origin}/api/listings${pathname ? `/${pathname}` : ""}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (method === "GET") return GET(request);
  if (method === "PATCH") return PATCH(request);
  return POST(request);
}

async function account(email: string) {
  const token = randomToken();
  const user = await User.create({ email, passwordHash: "not-a-secret", displayName: "Ada", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01"), roles: ["user"], verificationStatus: "approved", status: "active" });
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) });
  return { user, cookie: `sid=${encodeURIComponent(token)}` };
}

async function photo(ownerId: mongoose.Types.ObjectId, listingId: string, name: string) {
  return MediaAsset.create({ ownerId, listingId, kind: "image", objectKey: `listings/${name}`, status: "cleared", clearedAt: new Date(), contentType: "image/jpeg" });
}

/** A draft with no description, one photo and a phone number: everything a publish needs except the description. */
async function draftWithoutDescription(cookie: string, ownerId: mongoose.Types.ObjectId) {
  const category = await Category.create({ slug: "cycles", name: "Cycles", enabled: true, fields: [] });
  const city = await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
  const created = await call("POST", "", { categoryId: category._id.toString(), cityId: city._id.toString(), title: "City cycle" }, cookie);
  expect(created.status).toBe(201);
  const id = (await created.json()).data.id as string;
  const media = await photo(ownerId, id, "one");
  expect((await call("PATCH", id, { stage: "details", contact: { phone: "9000000011", acceptForm: false } }, cookie)).status).toBe(200);
  expect((await call("PATCH", id, { stage: "photos", mediaIds: [media._id.toString()] }, cookie)).status).toBe(200);
  return id;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(disconnectMemoryMongo);
beforeEach(clearMemoryMongo);

describe("H19.6 the description is optional", () => {
  it("publishes an ad with no description and shows no placeholder text", async () => {
    const owner = await account("nodesc@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    const res = await call("POST", `${id}/submit`, { attestations }, owner.cookie);
    expect(res.status).toBe(200);
    expect((await Listing.findById(id))?.description.trim()).toBe("");
  });

  it("clearing the description on an edit removes the old text instead of keeping it", async () => {
    const owner = await account("clear@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    await call("PATCH", id, { stage: "basics", description: "A short note about the cycle" }, owner.cookie);
    expect((await Listing.findById(id))?.description).toBe("A short note about the cycle");
    expect((await call("PATCH", id, { stage: "basics", description: "   " }, owner.cookie)).status).toBe(200);
    expect((await Listing.findById(id))?.description.trim()).toBe("");
  });

  it("accepts a one-word description too: there is no minimum any more", async () => {
    const owner = await account("short@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    expect((await call("PATCH", id, { stage: "basics", description: "Hi" }, owner.cookie)).status).toBe(200);
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
  });

  it("still needs a title and a city", async () => {
    const owner = await account("notitle@example.com");
    const category = await Category.create({ slug: "cycles", name: "Cycles", enabled: true, fields: [] });
    const created = await call("POST", "", { categoryId: category._id.toString() }, owner.cookie);
    const id = (await created.json()).data.id as string;
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(400);
  });
});

describe("H19.6 interests are saved as a list", () => {
  it("keeps up to five interests through the save and the publish", async () => {
    const owner = await account("interests@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    const interests = ["Music", "Travel", "Cooking", "Cricket", "Films"];
    const saved = await call("PATCH", id, { stage: "details", attributes: { interests } }, owner.cookie);
    expect(saved.status).toBe(200);
    expect((await call("POST", `${id}/submit`, { attestations }, owner.cookie)).status).toBe(200);
    const row = await Listing.findById(id).lean();
    expect((row?.attributes as Record<string, unknown>).interests).toEqual(interests);
  });

  it("refuses a sixth interest and an interest that is too long", async () => {
    const owner = await account("toomany@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    const six = await call("PATCH", id, { stage: "details", attributes: { interests: ["a", "b", "c", "d", "e", "f"] } }, owner.cookie);
    expect(six.status).toBe(400);
    const long = await call("PATCH", id, { stage: "details", attributes: { interests: ["x".repeat(31)] } }, owner.cookie);
    expect(long.status).toBe(400);
    const notList = await call("PATCH", id, { stage: "details", attributes: { interests: "Music" } }, owner.cookie);
    expect(notList.status).toBe(400);
  });

  it("an empty list is dropped on publish, and a blank word is not an interest", () => {
    expect(parseSavedAttributes([], { interests: [] })).toEqual({});
    expect(validInterests(["Music", " "])).toBe(false);
    expect(validInterests(Array.from({ length: INTEREST_MAX }, (_, i) => `tag${i}`))).toBe(true);
    expect(validInterests(Array.from({ length: INTEREST_MAX + 1 }, (_, i) => `tag${i}`))).toBe(false);
  });
});

describe("H19.6 make cover", () => {
  it("sets the cover and puts that photo first, and it stays after a reload", async () => {
    const owner = await account("cover@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    const [first, second, third] = [await MediaAsset.findOne({ listingId: id }), await photo(owner.user._id, id, "two"), await photo(owner.user._id, id, "three")];
    const ids = [first!._id.toString(), second._id.toString(), third._id.toString()];
    await call("PATCH", id, { stage: "photos", mediaIds: ids }, owner.cookie);
    expect((await listDraftMedia(owner.user._id.toString(), id)).coverId).toBe(ids[0]);
    // What the Make cover button sends: the chosen photo first, and as the cover.
    const reorder = [ids[2], ids[0], ids[1]];
    expect((await call("PATCH", id, { stage: "photos", mediaIds: reorder, coverMediaId: ids[2] }, owner.cookie)).status).toBe(200);
    const after = await listDraftMedia(owner.user._id.toString(), id);
    expect(after.coverId).toBe(ids[2]);
    expect(after.photos.map((row) => row.id)).toEqual(reorder);
    expect(after.photos[0].isCover).toBe(true);
    const view = await call("GET", `by-id/${id}`, undefined, owner.cookie);
    expect(((await view.json()).data as { coverMediaId?: string }).coverMediaId ?? ids[2]).toBe(ids[2]);
  });

  it("refuses a cover that is not one of the photos", async () => {
    const owner = await account("badcover@example.com");
    const id = await draftWithoutDescription(owner.cookie, owner.user._id);
    const other = await photo(owner.user._id, id, "other");
    const mine = (await MediaAsset.findOne({ listingId: id, objectKey: "listings/one" }))!._id.toString();
    const res = await call("PATCH", id, { stage: "photos", mediaIds: [mine], coverMediaId: other._id.toString() }, owner.cookie);
    expect(res.status).toBe(400);
  });
});
