import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { categoryPictureItems, setCategoryPictures } from "@/server/categories/manage";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { findPlacesForPictures, setPlacePictures } from "@/server/locations/manage";
import { AuditEvent, Category, Location, SiteMedia } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000091", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const seo: AdminCtx = { actorId: "000000000000000000000092", email: "seo@example.com", roles: ["seo_editor"], requestId: "r-s" };

async function picture(alt = "A living room", extra: Record<string, unknown> = {}) {
  const doc = await SiteMedia.create({ url: `/uploads/${new mongoose.Types.ObjectId()}.png`, objectKey: `k-${Math.random()}`, alt, width: 1920, height: 700, bytes: 1000, contentType: "image/png", tags: [], uploadedBy: "a@example.com", ...extra });
  return String(doc._id);
}

async function category(name = "Property") {
  return Category.create({ slug: name.toLowerCase(), name, enabled: true, order: 0 });
}

const photo = (assetId: string, alt = "A flat in Surat") => ({ assetId, alt, focusX: 40, focusY: 60 });
const band = (assetId: string, phoneAssetId: string | null = null, alt = "Wide view of a street") => ({ assetId, phoneAssetId, alt, focusX: 50, focusY: 30 });

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

describe("pictures of a category", () => {
  it("saves a photo and a band with a description and focus points, audits it, and shows them back with the library image", async () => {
    const cat = await category();
    const first = await picture();
    const wide = await picture("Wide");
    const phone = await picture("Tall");
    const done = await setCategoryPictures(admin, String(cat._id), { photo: photo(first), band: band(wide, phone) });
    expect(done.name).toBe("Property");
    const saved = await Category.findById(cat._id).lean();
    expect(saved?.photo).toMatchObject({ focusX: 40, focusY: 60, alt: "A flat in Surat" });
    expect(String(saved?.photo?.mediaId)).toBe(first);
    expect(saved?.band).toMatchObject({ focusX: 50, focusY: 30, alt: "Wide view of a street" });
    expect(String(saved?.band?.phoneMediaId)).toBe(phone);
    const row = await AuditEvent.findById(done.eventId).lean();
    expect(row).toMatchObject({ action: "category.pictures", actorRole: "admin", targetLabel: "Property" });
    expect(row?.undo?.kind).toBe("record.restore");
    const [item] = await categoryPictureItems();
    expect(item.pictures.photo?.image).toMatchObject({ assetId: first, alt: "A flat in Surat" });
    expect(item.pictures.band?.phone?.assetId).toBe(phone);
  });

  it("clears a picture that is left out, and Undo puts the earlier pictures back (and a second undo is refused)", async () => {
    const cat = await category();
    const a = await picture();
    const b = await picture("Wide");
    await setCategoryPictures(admin, String(cat._id), { photo: photo(a), band: band(b) });
    const cleared = await setCategoryPictures(admin, String(cat._id), { photo: photo(a), band: null });
    expect((await Category.findById(cat._id).lean())?.band ?? null).toBeNull();
    expect(await undoEvent(admin, cleared.eventId)).toMatchObject({ ok: true });
    const back = await Category.findById(cat._id).lean();
    expect(String(back?.band?.mediaId)).toBe(b);
    expect(await undoEvent(admin, cleared.eventId)).toMatchObject({ ok: false, reason: "already_undone" });
  });

  it("refuses a missing description, a description that is too long, a bad focus point, a picture that is not in the library and one in the Trash", async () => {
    const cat = await category();
    const id = String(cat._id);
    const ok = await picture();
    await expect(setCategoryPictures(admin, id, { photo: photo(ok, " "), band: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(setCategoryPictures(admin, id, { photo: photo(ok, "x".repeat(126)), band: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(setCategoryPictures(admin, id, { photo: { ...photo(ok), focusX: 101 }, band: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(setCategoryPictures(admin, id, { photo: photo("nope"), band: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(setCategoryPictures(admin, id, { photo: photo(String(new mongoose.Types.ObjectId())), band: null })).rejects.toBeInstanceOf(ValidationError);
    const trashed = await picture("Old", { trashedAt: new Date() });
    await expect(setCategoryPictures(admin, id, { photo: photo(trashed), band: null })).rejects.toBeInstanceOf(ValidationError);
    expect((await Category.findById(cat._id).lean())?.photo ?? null).toBeNull();
    expect(await AuditEvent.countDocuments({ action: "category.pictures" })).toBe(0);
  });

  it("is for admins only and says not found for an unknown category", async () => {
    const cat = await category();
    const ok = await picture();
    await expect(setCategoryPictures(seo, String(cat._id), { photo: photo(ok), band: null })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setCategoryPictures(admin, String(new mongoose.Types.ObjectId()), { photo: photo(ok), band: null })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setCategoryPictures(admin, "bad", { photo: photo(ok), band: null })).rejects.toBeInstanceOf(NotFoundError);
    expect((await Category.findById(cat._id).lean())?.photo ?? null).toBeNull();
  });
});

describe("pictures of a place", () => {
  it("finds places by the first letters of the name, shows their pictures, and saves and undoes like a category", async () => {
    const surat = await Location.create({ type: "city", slug: "surat", name: "Surat", enabled: true });
    await Location.create({ type: "city", slug: "pune", name: "Pune", enabled: true });
    const found = await findPlacesForPictures("su");
    expect(found.map((item) => item.name)).toEqual(["Surat"]);
    expect((await findPlacesForPictures("")).length).toBe(2);
    expect((await findPlacesForPictures("(")).length).toBe(0);
    const id = await picture("Surat skyline");
    const done = await setPlacePictures(admin, String(surat._id), { photo: photo(id, "The Surat skyline"), band: band(id) });
    expect(done.name).toBe("Surat");
    expect((await findPlacesForPictures("surat"))[0].pictures.photo?.image.alt).toBe("The Surat skyline");
    await undoEvent(admin, done.eventId);
    expect((await Location.findById(surat._id).lean())?.photo ?? null).toBeNull();
  });
});
