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
  const to = await Category.create({ slug: "friendship", name: "Friendship", enabled: true, order: 1 });
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
    expect(done).toMatchObject({ moved: 3, alreadyThere: 0, categoryName: "Friendship" });
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
    await expect(moveAdsToCategory(admin, { categoryId: String(to._id), scope: "selected", ids })).rejects.toThrow("already in Friendship");
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
