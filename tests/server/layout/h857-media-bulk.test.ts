import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { listSiteMedia } from "@/server/layout/media";
import { trashManyMedia } from "@/server/layout/media-bulk";
import { AuditEvent, Category, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles: ["admin"], requestId: "r" };
const support: AdminCtx = { actorId: String(new mongoose.Types.ObjectId()), email: "sup@example.test", roles: ["support"], requestId: "r2" };

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

async function picture(alt: string, extra: Record<string, unknown> = {}) {
  const doc = await SiteMedia.create({ url: `/uploads/${new mongoose.Types.ObjectId()}.png`, objectKey: `k-${Math.random()}`, alt, width: 800, height: 600, bytes: 9000, contentType: "image/png", tags: [], uploadedBy: "a@example.com", ...extra });
  return String(doc._id);
}

describe("H8.57 several pictures to the Trash", () => {
  it("moves the unused ones, leaves a picture that a category uses and says why, and each move has its own Undo", async () => {
    const [a, b, used] = [await picture("A tidy kitchen"), await picture("A balcony"), await picture("Dating card")];
    await Category.create({ slug: "dating", name: "Dating", enabled: true, photo: { mediaId: used, focusX: 50, focusY: 50, alt: "Card" } });
    const done = await trashManyMedia(admin, [a, b, used, a]);
    expect(done.trashed.map((row) => row.id)).toEqual([a, b]);
    expect(done.refused).toHaveLength(1);
    expect(done.refused[0].id).toBe(used);
    expect(done.refused[0].reason.length).toBeGreaterThan(5);
    expect((await SiteMedia.findById(a).lean())?.trashedAt).toBeTruthy();
    expect((await SiteMedia.findById(used).lean())?.trashedAt ?? null).toBeNull();
    expect(await AuditEvent.countDocuments({ action: "media.trash" })).toBe(2);
    expect(await undoEvent(admin, done.trashed[0].eventId)).toMatchObject({ ok: true });
    expect((await SiteMedia.findById(a).lean())?.trashedAt ?? null).toBeNull();
    expect((await SiteMedia.findById(b).lean())?.trashedAt).toBeTruthy();
  });

  it("refuses an empty list, too many, and a role that may not use the library", async () => {
    const a = await picture("One");
    await expect(trashManyMedia(admin, [])).rejects.toBeInstanceOf(ValidationError);
    await expect(trashManyMedia(admin, Array.from({ length: 101 }, () => String(new mongoose.Types.ObjectId())))).rejects.toBeInstanceOf(ValidationError);
    await expect(trashManyMedia(support, [a])).rejects.toBeInstanceOf(ForbiddenError);
    expect((await SiteMedia.findById(a).lean())?.trashedAt ?? null).toBeNull();
  });

  it("the to-do list is what has no description or only the file name, and nothing is filled in", async () => {
    await picture("A real description of a picture");
    await picture("sunset-beach", { altAuto: true });
    await picture("ab");
    const missing = await listSiteMedia({ missingAlt: true, limit: 50, skip: 0 }, ["admin"]);
    expect(missing.items.map((item) => item.alt).sort()).toEqual(["ab", "sunset-beach"]);
    expect(missing.items.every((item) => item.missingAlt)).toBe(true);
  });
});
