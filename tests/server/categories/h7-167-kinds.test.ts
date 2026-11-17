import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { VIDEO_NEVER_FOR_PEOPLE } from "@/lib/category-kinds";
import { createKind, effectiveKind, kindAllowsVideo, kindFeatures, kindMaxPhotos, listKinds, removeKind, updateKind } from "@/server/categories/kinds";
import { createCategory, updateCategory } from "@/server/categories/manage";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Category, Listing } from "@/server/models";
import { updateVideoTourSettings } from "@/server/tours/service";
import { assertVideoTourAllowed } from "@/server/wallet/listing-guard";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000071", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const editor: AdminCtx = { actorId: "000000000000000000000072", email: "editor@example.com", roles: ["content_editor"], requestId: "r-e" };
const support: AdminCtx = { actorId: "000000000000000000000073", email: "support@example.com", roles: ["support"], requestId: "r-s" };
const actor = { email: "a@example.com", roles: ["admin"] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function category(slug: string, kind: string, extra: Record<string, unknown> = {}) {
  const { insertedId } = await Category.collection.insertOne({ slug, name: slug, enabled: true, kind, videoTourEnabled: true, videoTourCoins: 1, fields: [], ...extra });
  return String(insertedId);
}

async function adIn(categoryId: string) {
  const listing = await Listing.create({
    ownerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(categoryId),
    status: "active",
    title: "Hello there",
    description: "A description that is long enough",
    publishedAt: new Date(),
  });
  return String(listing._id);
}

describe("the Kinds manager (H7.167)", () => {
  it("starts with the six built-in kinds and counts the categories that use each", async () => {
    await category("property", "property");
    const kinds = await listKinds();
    expect(kinds.map((kind) => kind.key)).toEqual(["goods", "property", "vehicle", "job", "service", "people"]);
    expect(kinds.find((kind) => kind.key === "property")?.used).toBe(1);
    expect(kinds.find((kind) => kind.key === "people")).toMatchObject({ videoTours: false, builtIn: true });
  });

  it("adds, renames and changes a kind with an audit row and an Undo, and refuses bad input", async () => {
    const added = await createKind(admin, { name: "Events", icon: "tag", maxPhotos: 6, showMap: false, videoTours: true });
    expect(added.key).toBe("events");
    expect((await listKinds()).find((kind) => kind.key === "events")).toMatchObject({ name: "Events", maxPhotos: 6, showMap: false, showPrice: true, videoTours: true });
    const renamed = await updateKind(admin, "events", { name: "Events and shows", maxPhotos: null, showContact: false });
    expect(await AuditEvent.findById(renamed.eventId).lean()).toMatchObject({ action: "category_kind.update", actorRole: "admin" });
    expect((await listKinds()).find((kind) => kind.key === "events")).toMatchObject({ name: "Events and shows", maxPhotos: null, showContact: false });
    expect(await undoEvent(admin, renamed.eventId)).toMatchObject({ ok: true });
    expect((await listKinds()).find((kind) => kind.key === "events")).toMatchObject({ name: "Events", maxPhotos: 6, showContact: true });
    expect(await undoEvent(admin, added.eventId)).toMatchObject({ ok: true });
    expect((await listKinds()).some((kind) => kind.key === "events")).toBe(false);
    await expect(createKind(admin, { name: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createKind(admin, { name: "Fine name", maxPhotos: 31 })).rejects.toThrow(/1 to 30/);
    await expect(createKind(admin, { name: "Fine name", icon: "not-an-icon" })).rejects.toThrow(/icon/);
    await expect(createKind(admin, { name: "Goods" })).rejects.toThrow(/already exists/);
  });

  it("removes a kind only when no category uses it, and Undo brings it back", async () => {
    await createKind(admin, { name: "Rentals" });
    await category("flats", "rentals");
    await expect(removeKind(admin, "rentals")).rejects.toThrow(/1 category uses this kind/);
    await Category.deleteMany({});
    const gone = await removeKind(admin, "rentals");
    expect((await listKinds()).some((kind) => kind.key === "rentals")).toBe(false);
    expect(await undoEvent(admin, gone.eventId)).toMatchObject({ ok: true });
    expect((await listKinds()).some((kind) => kind.key === "rentals")).toBe(true);
    await expect(removeKind(admin, "people")).rejects.toThrow(/built in/);
  });

  it("is for admins and content editors, not for support", async () => {
    await expect(createKind(support, { name: "Sneaky" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await createKind(editor, { name: "Crafts" })).key).toBe("crafts");
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(1);
  });

  it("a category must pick a kind that exists, and a new category can use an added kind", async () => {
    await createKind(admin, { name: "Events" });
    await expect(createCategory(actor, { name: "Shows", kind: "nope" })).rejects.toThrow(/kind/);
    const made = await createCategory(actor, { name: "Shows", kind: "events" });
    expect((await Category.findOne({ slug: made.slug }).lean())?.kind).toBe("events");
  });

  it("feeds the ad page features and the photo limit of a kind", async () => {
    await createKind(admin, { name: "Notices", maxPhotos: 3, showPrice: false, showContact: false });
    expect(await kindFeatures("notices")).toEqual({ price: false, map: true, contact: false });
    expect(await kindFeatures("goods")).toEqual({ price: true, map: true, contact: true });
    expect(await kindMaxPhotos("notices")).toBe(3);
    expect(await kindMaxPhotos("goods")).toBeNull();
  });
});

describe("the locked people rule (H7.167)", () => {
  it("a people slug or an 18+ age field behaves as People whatever kind it is given", () => {
    expect(effectiveKind({ slug: "dating", kind: "goods" })).toBe("people");
    expect(effectiveKind({ slug: "meet-up-friends", kind: "service", fields: [{ key: "age", min: 18 }] })).toBe("people");
    expect(effectiveKind({ slug: "bikes", kind: "vehicle", fields: [{ key: "age", min: 16 }] })).toBe("vehicle");
  });

  it("refuses a video tour hold on a people listing even when its kind allows video and its switch is on", async () => {
    const dating = await category("dating", "goods");
    const ageGated = await category("friends-near-you", "service", { fields: [{ key: "age", label: "Age", type: "number", min: 18 }] });
    for (const id of [dating, ageGated]) {
      const listing = await adIn(id);
      await expect(assertVideoTourAllowed(listing)).rejects.toThrow(/people/i);
    }
    expect(await kindAllowsVideo({ slug: "dating", kind: "goods" })).toBe(false);
  });

  it("allows a tour only when the kind allows video and the category switch is on", async () => {
    await createKind(admin, { name: "Showrooms", videoTours: true });
    await createKind(admin, { name: "Archive", videoTours: false });
    const on = await adIn(await category("showrooms", "showrooms"));
    await expect(assertVideoTourAllowed(on)).resolves.toBeUndefined();
    const off = await adIn(await category("old-things", "archive"));
    await expect(assertVideoTourAllowed(off)).rejects.toThrow(/off/);
    const switchedOff = await adIn(await category("more-showrooms", "showrooms", { videoTourEnabled: false }));
    await expect(assertVideoTourAllowed(switchedOff)).rejects.toThrow(/off/);
  });

  it("the video switch cannot be turned on for a people listing, and saving a people category turns it off", async () => {
    const id = await category("dating", "goods");
    const refused = await updateVideoTourSettings({ actorId: "000000000000000000000071", roles: ["superadmin"], categoryId: id, enabled: true, requestId: "r" }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ValidationError);
    expect(JSON.stringify(refused)).toContain(VIDEO_NEVER_FOR_PEOPLE);
    const saved = await updateVideoTourSettings({ actorId: "000000000000000000000071", roles: ["superadmin"], categoryId: id, coins: 2, requestId: "r" });
    expect(saved.videoTourEnabled).toBe(false);
    await Category.updateOne({ _id: id }, { $set: { videoTourEnabled: true } });
    await updateCategory(actor, id, { description: "People here" });
    expect((await Category.findById(id).lean())?.videoTourEnabled).toBe(false);
  });

  it("People can never be given video, even by a direct call", async () => {
    await expect(updateKind(admin, "people", { videoTours: true })).rejects.toThrow(VIDEO_NEVER_FOR_PEOPLE);
  });
});
