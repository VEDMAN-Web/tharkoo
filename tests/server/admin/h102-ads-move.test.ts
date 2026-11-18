import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { parseAdsQuery } from "@/server/admin/ads-list";
import { moveAdsToCategory } from "@/server/admin/ads-move";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, Category, Listing } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles: ["admin"], requestId: "r" };
const support: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "sup@example.test", roles: ["support"], requestId: "r2" };
const oid = () => new mongoose.Types.ObjectId();

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

async function world(count = 3) {
  const from = await Category.create({ slug: "transgender", name: "Transgender", enabled: true, order: 0 });
  const to = await Category.create({ slug: "classifieds", name: "Classifieds", enabled: true, order: 1 });
  const sub = oid();
  const owner = oid();
  const ads = await Listing.create(
    Array.from({ length: count }, (_, index) => ({ ownerId: owner, categoryId: from._id, subcategoryId: sub, title: `Old friendship ad ${index}`, description: "A description that is long enough", slug: `old-${index}`, status: "active" as const })),
  );
  return { from, to, sub, ads };
}

describe("H10.2 move ads to another category", () => {
  it("moves the selected ads, clears the sub-category, writes ONE audit row, and one Undo puts everything back", async () => {
    const { from, to, sub, ads } = await world(3);
    const done = await moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids: ads.map((ad) => String(ad._id)) });
    expect(done).toMatchObject({ moved: 3, alreadyThere: 0, categoryName: "Classifieds" });
    for (const ad of ads) {
      const row = await Listing.findById(ad._id).lean();
      expect(String(row?.categoryId)).toBe(String(to._id));
      expect(row?.subcategoryId ?? null).toBeNull();
    }
    expect(await AuditEvent.countDocuments({ action: "listing.move_category" })).toBe(1);
    const event = await AuditEvent.findById(done.eventId).lean();
    expect(event?.undo?.kind).toBe("ads.move");
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    for (const ad of ads) {
      const row = await Listing.findById(ad._id).lean();
      expect(String(row?.categoryId)).toBe(String(from._id));
      expect(String(row?.subcategoryId)).toBe(String(sub));
    }
  });

  it("moves every ad that matches the filter (more than a hundred), asks for the number, and skips ads already there", async () => {
    const { from, to, ads } = await world(130);
    await Listing.updateOne({ _id: ads[0]._id }, { $set: { categoryId: to._id } });
    const query = parseAdsQuery({ cat: String(from._id) });
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "filter", query })).rejects.toThrow("Type 129 to confirm");
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "filter", query, confirm: "12" })).rejects.toBeInstanceOf(ValidationError);
    const done = await moveAdsToCategory(admin, { categoryId: String(to._id), scope: "filter", query, confirm: "129" });
    expect(done.moved).toBe(129);
    expect(await Listing.countDocuments({ categoryId: to._id })).toBe(130);
    expect(await Listing.countDocuments({ categoryId: from._id })).toBe(0);
    const again = await moveAdsToCategory(admin, { categoryId: String(from._id), scope: "selected", ids: [String(ads[0]._id), String(ads[1]._id)] });
    expect(again.moved).toBe(2);
  });

  it("refuses more than a hundred selected ads, no ads, a missing category, ads already there, and a role without the permission; nothing moves", async () => {
    const { to, ads } = await world(2);
    const ids = ads.map((ad) => String(ad._id));
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids: Array.from({ length: 101 }, () => String(oid())) })).rejects.toThrow("at most 100");
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(moveAdsToCategory(admin, { categoryId: String(oid()), scope: "selected", ids })).rejects.toThrow("not there any more");
    await expect(moveAdsToCategory(admin, { categoryId: "nope", scope: "selected", ids })).rejects.toBeInstanceOf(ValidationError);
    await expect(moveAdsToCategory(support, { categoryId: String(to._id), scope: "selected", ids })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await Listing.countDocuments({ categoryId: to._id })).toBe(0);
    await moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids });
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids })).rejects.toThrow("already in Classifieds");
  });

  it("refuses to move ads out of a people category into a non-people category, by kind, by slug and by an age field; nothing moves", async () => {
    const people = await Category.create({ slug: "my-group", name: "My group", kind: "people", enabled: true, order: 0 });
    const bySlug = await Category.create({ slug: "dating", name: "Dating", enabled: true, order: 1 });
    const byAge = await Category.create({ slug: "circle", name: "Circle", enabled: true, order: 2, fields: [{ key: "age", label: "Age", type: "number", min: 18 }] });
    const goods = await Category.create({ slug: "classifieds", name: "Classifieds", enabled: true, order: 3 });
    for (const from of [people, bySlug, byAge]) {
      const ad = await Listing.create({ ownerId: oid(), categoryId: from._id, title: `Ad in ${from.name}`, description: "A description that is long enough", slug: `p-${from.slug}`, status: "active" as const, attributes: { age: 30 } });
      await expect(moveAdsToCategory(admin, { categoryId: String(goods._id), scope: "selected", ids: [String(ad._id)] })).rejects.toThrow("These ads are about people, so they can only move to another people category.");
      expect(String((await Listing.findById(ad._id).lean())?.categoryId)).toBe(String(from._id));
    }
    expect(await AuditEvent.countDocuments({ action: "listing.move_category" })).toBe(0);
    // One people ad among the ads is enough to refuse the whole move; the goods ad stays where it is.
    const goodsAd = await Listing.create({ ownerId: oid(), categoryId: goods._id, title: "A goods ad", description: "A description that is long enough", slug: "mixed-goods", status: "active" as const });
    const tools = await Category.create({ slug: "tools", name: "Tools", enabled: true, order: 4 });
    const peopleAd = await Listing.findOne({ slug: "p-my-group" }).lean();
    await expect(moveAdsToCategory(admin, { categoryId: String(tools._id), scope: "selected", ids: [String(goodsAd._id), String(peopleAd?._id)] })).rejects.toThrow("only move to another people category");
    expect(String((await Listing.findById(goodsAd._id).lean())?.categoryId)).toBe(String(goods._id));
    expect(await AuditEvent.countDocuments({ action: "listing.move_category" })).toBe(0);
  });

  it("allows people to people, and non-people into people only when every ad has an age of 18 or more; otherwise refuses and says how many lack it", async () => {
    const people = await Category.create({ slug: "my-group", name: "My group", kind: "people", enabled: true, order: 0 });
    const people2 = await Category.create({ slug: "friendship", name: "Friendship", enabled: true, order: 1 });
    const goods = await Category.create({ slug: "classifieds", name: "Classifieds", enabled: true, order: 2 });
    const make = (slug: string, categoryId: mongoose.Types.ObjectId, attributes?: Record<string, unknown>) =>
      Listing.create({ ownerId: oid(), categoryId, title: slug, description: "A description that is long enough", slug, status: "active" as const, ...(attributes ? { attributes } : {}) });
    const adult = await make("adult", goods._id, { age: 25 });
    const adultText = await make("adult-text", goods._id, { age: "40" });
    const noAge = await make("no-age", goods._id);
    const young = await make("young", goods._id, { age: 17 });
    const inPeople = await make("in-people", people._id);
    // People to people is allowed, even when the ad has no age.
    expect(await moveAdsToCategory(admin, { categoryId: String(people2._id), scope: "selected", ids: [String(inPeople._id)] })).toMatchObject({ moved: 1 });
    // Non-people into people: refused when some ads have no age of 18 or more, and the number is said.
    await expect(moveAdsToCategory(admin, { categoryId: String(people._id), scope: "selected", ids: [adult, adultText, noAge, young].map((ad) => String(ad._id)) })).rejects.toThrow("2 of the 4 ads");
    expect(await Listing.countDocuments({ categoryId: people._id })).toBe(0);
    // Allowed when every ad has an age of 18 or more (a number, or digits).
    const done = await moveAdsToCategory(admin, { categoryId: String(people._id), scope: "selected", ids: [adult, adultText].map((ad) => String(ad._id)) });
    expect(done.moved).toBe(2);
    expect(await Listing.countDocuments({ categoryId: people._id })).toBe(2);
  });

  it("Undo refuses when one of the ads was moved again since, and leaves every ad where it is", async () => {
    const { to, ads } = await world(3);
    const done = await moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids: ads.map((ad) => String(ad._id)) });
    const elsewhere = await Category.create({ slug: "meetups", name: "Meetups", enabled: true, order: 2 });
    await Listing.updateOne({ _id: ads[1]._id }, { $set: { categoryId: elsewhere._id } });
    const outcome = await undoEvent(admin, done.eventId);
    expect(outcome.ok).toBe(false);
    expect(await Listing.countDocuments({ categoryId: to._id })).toBe(2);
  });
});
