import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { effectiveKind, isPeopleListing } from "@/server/categories/kinds";
import { changeCategoryKind, PEOPLE_OFF_QUESTION, updateCategory } from "@/server/categories/manage";
import { PEOPLE_AGE_FIELD, withPeopleAge } from "@/server/categories/people-age";
import { ValidationError } from "@/server/http";
import { fieldDefs, patchListing, submitListing } from "@/server/listings/service";
import { AuditEvent, Category, Listing, User } from "@/server/models";
import { evaluatePublishGate } from "@/server/shared/publish-gate";
import { parseListingAttributes } from "@/server/shared/fields";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000071", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const actor = { email: "admin@example.com", roles: ["admin"] };

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

/** A renamed people category: a new slug, the People kind, and a form with no age field (its only field is Interest). */
async function renamedPeople() {
  return Category.create({
    slug: "interest-circle",
    name: "Interest circle",
    enabled: true,
    kind: "people",
    videoTourEnabled: false,
    fields: [{ key: "interest", label: "Interest", type: "select", required: true, options: ["Coffee", "Walks"], order: 0, enabled: true }],
  });
}

const gateBase = {
  dateOfBirth: new Date("1990-01-01"),
  attestedAdult: true,
  verificationStatus: "approved" as const,
  accountStatus: "active" as const,
  categorySlug: "interest-circle",
  categoryName: "Interest circle",
  categoryEnabled: true,
  mediaCleared: true,
  idCheckRequired: false,
};

describe("H10.1 people protection", () => {
  it("a People-kind category always carries the age check, even renamed and with no age field", async () => {
    const category = await renamedPeople();
    expect(isPeopleListing(category)).toBe(true);
    expect(effectiveKind(category)).toBe("people");
    const defs = fieldDefs(category);
    expect(defs.map((def) => def.key)).toEqual(["interest", "age"]);
    expect(defs.find((def) => def.key === "age")).toMatchObject({ required: true, min: 18, max: 99 });
    expect(withPeopleAge({ slug: "x", kind: "goods", fields: [] }, [])).toEqual([]);
    expect(withPeopleAge({ slug: "x", kind: "people", fields: [] }, [{ ...PEOPLE_AGE_FIELD, min: 21 }])).toEqual([{ ...PEOPLE_AGE_FIELD, min: 21 }]);
    expect(() => parseListingAttributes(defs, { interest: "Coffee" })).toThrow();
    expect(() => parseListingAttributes(defs, { interest: "Coffee", age: 17 })).toThrow();
    expect(parseListingAttributes(defs, { interest: "Coffee", age: 28 })).toEqual({ interest: "Coffee", age: 28 });
  });

  it("the publish gate refuses a people ad with no age or under 18, and lets other ads through without one", () => {
    expect(evaluatePublishGate({ ...gateBase, attributes: {}, peopleListing: true })).toEqual({ ok: false, reason: "AGE_REQUIRED", detail: "age" });
    expect(evaluatePublishGate({ ...gateBase, attributes: { age: 17 }, peopleListing: true })).toMatchObject({ ok: false, reason: "UNDERAGE" });
    expect(evaluatePublishGate({ ...gateBase, attributes: { age: 18 }, peopleListing: true })).toEqual({ ok: true });
    expect(evaluatePublishGate({ ...gateBase, attributes: {}, peopleListing: false })).toEqual({ ok: true });
  });

  it("submitting a renamed people ad needs an age of 18 or more", async () => {
    const category = await renamedPeople();
    const user = await User.create({ email: "asha@example.com", displayName: "Asha", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
    const draft = (attributes: Record<string, unknown>) =>
      Listing.create({ ownerId: user._id, categoryId: category._id, title: "Coffee and a walk", description: "Looking to meet for coffee and a walk.", status: "draft", cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, attributes });
    const attest = { adult: true, accurate: true, rights: true } as const;
    const without = await draft({ interest: "Coffee" });
    await expect(submitListing(String(without._id), String(user._id), attest, "r1")).rejects.toThrow();
    const young = await draft({ interest: "Coffee", age: 17 });
    await expect(submitListing(String(young._id), String(user._id), attest, "r2")).rejects.toThrow();
    const fine = await draft({ interest: "Coffee", age: 28 });
    await expect(submitListing(String(fine._id), String(user._id), attest, "r3")).resolves.toBeTruthy();
  });

  it("H18.11: an ad publishes even when its saved answers hold an age or an old field its category does not ask for", async () => {
    const category = await Category.create({ slug: "pride-circle", name: "Pride circle", enabled: true, kind: "community", fields: [{ key: "interest", label: "Interest", type: "text", required: true, order: 0, enabled: true }] });
    const user = await User.create({ email: "ravi@example.com", displayName: "Ravi", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
    const ad = await Listing.create({ ownerId: user._id, categoryId: category._id, title: "Book club on Sundays", description: "Join us for books and tea every Sunday.", status: "draft", cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, attributes: { interest: "Likes, 1", age: 26, oldField: "left over" } });
    await expect(submitListing(String(ad._id), String(user._id), { adult: true, accurate: true, rights: true }, "r9")).resolves.toBeTruthy();
    const saved = await Listing.findById(ad._id).lean<{ attributes: Record<string, unknown> }>();
    expect(saved?.attributes).toEqual({ interest: "Likes, 1", age: 26 });
  });

  it("H18.12: a live ad with an age its category does not list can still be edited", async () => {
    const category = await Category.create({ slug: "pride-edit", name: "Pride edit", enabled: true, kind: "community", fields: [{ key: "interest", label: "Interest", type: "text", required: true, order: 0, enabled: true }] });
    const user = await User.create({ email: "meera@example.com", displayName: "Meera", passwordHash: "x", status: "active", roles: ["user"], dateOfBirth: new Date("1990-01-01"), attestedAdultAt: new Date(), verificationStatus: "approved" });
    const ad = await Listing.create({ ownerId: user._id, categoryId: category._id, title: "Book club on Sundays", description: "Join us for books and tea every Sunday.", status: "draft", cityId: new mongoose.Types.ObjectId(), contact: { phone: "9876543210" }, attributes: { interest: "Books", age: 30 } });
    await submitListing(String(ad._id), String(user._id), { adult: true, accurate: true, rights: true }, "e1");
    await expect(patchListing(String(ad._id), String(user._id), { stage: "details", attributes: { interest: "Books and tea", age: 30 } }, "e2")).resolves.toBeTruthy();
  });

  it("changing the Kind away from People needs a yes first, is audited and can be undone", async () => {
    const category = await renamedPeople();
    const id = String(category._id);
    await expect(changeCategoryKind(admin, id, "service")).rejects.toThrow(PEOPLE_OFF_QUESTION);
    await expect(changeCategoryKind(admin, id, "service", { confirmPeopleOff: false })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCategory(actor, id, { kind: "service" })).rejects.toThrow(PEOPLE_OFF_QUESTION);
    expect((await Category.findById(id).lean())?.kind).toBe("people");
    const done = await changeCategoryKind(admin, id, "service", { confirmPeopleOff: true });
    expect(done).toMatchObject({ changed: true });
    expect((await Category.findById(id).lean())?.kind).toBe("service");
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "category.kind", actorRole: "admin" });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    expect((await Category.findById(id).lean())?.kind).toBe("people");
  });

  it("changing into People, or to the same kind, needs no question", async () => {
    const goods = await Category.create({ slug: "gadgets", name: "Gadgets", enabled: true, kind: "goods", fields: [] });
    expect(await changeCategoryKind(admin, String(goods._id), "people")).toMatchObject({ changed: true });
    expect(await changeCategoryKind(admin, String(goods._id), "people")).toEqual({ changed: false, eventId: "" });
  });
});
