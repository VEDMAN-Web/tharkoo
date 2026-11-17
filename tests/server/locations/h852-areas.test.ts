import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { createArea, removeArea, updateArea } from "@/server/locations/areas";
import { AuditEvent, Listing, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000091", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const support: AdminCtx = { actorId: "000000000000000000000092", email: "sup@example.com", roles: ["support"], requestId: "r-s" };
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

async function chain() {
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN" });
  const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: country._id });
  const city = await Location.create({ type: "city", slug: "surat", name: "Surat", parentId: state._id });
  return { country, state, city };
}

describe("H8.52 adding areas", () => {
  it("adds a district to a city and a locality to a district, and refuses any other parent", async () => {
    const { state, city } = await chain();
    const district = await createArea(admin, { parentId: String(city._id), name: "  Old   Town " });
    const row = await Location.findById(district.id).lean();
    expect(row).toMatchObject({ type: "district", name: "Old Town", slug: "old-town", enabled: true });
    expect(String(row?.parentId)).toBe(String(city._id));
    const locality = await createArea(admin, { parentId: district.id, name: "Market Road", slug: "market" });
    expect(await Location.findById(locality.id).lean()).toMatchObject({ type: "locality", slug: "market" });
    await expect(createArea(admin, { parentId: String(state._id), name: "Nope" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createArea(admin, { parentId: locality.id, name: "Nope" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createArea(admin, { parentId: String(city._id), name: "Old Town" })).rejects.toThrow("already used");
    await expect(createArea(admin, { parentId: String(city._id), name: "  " })).rejects.toThrow("Write a name");
    await expect(createArea(support, { parentId: String(city._id), name: "Other" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await AuditEvent.countDocuments({ action: "area.create" })).toBe(2);
  });
});

describe("H8.52 renaming, hiding and undo", () => {
  it("renames and hides one area, keeps its web address, and Undo puts the old name and visibility back", async () => {
    const { city } = await chain();
    const district = await createArea(admin, { parentId: String(city._id), name: "Old Town" });
    const renamed = await updateArea(admin, district.id, { name: "Heritage Quarter" });
    expect(await Location.findById(district.id).lean()).toMatchObject({ name: "Heritage Quarter", slug: "old-town" });
    const hidden = await updateArea(admin, district.id, { enabled: false });
    expect((await Location.findById(district.id).lean())?.enabled).toBe(false);
    expect(await undoEvent(admin, hidden.eventId)).toMatchObject({ ok: true });
    expect((await Location.findById(district.id).lean())?.enabled).toBe(true);
    expect(await undoEvent(admin, renamed.eventId)).toMatchObject({ ok: true });
    expect(await Location.findById(district.id).lean()).toMatchObject({ name: "Old Town", slug: "old-town" });
    await expect(updateArea(admin, district.id, {})).rejects.toBeInstanceOf(ValidationError);
    await expect(updateArea(support, district.id, { enabled: false })).rejects.toBeInstanceOf(ForbiddenError);
    const event = await AuditEvent.findOne({ action: "area.hide" }).lean();
    expect(event?.undo?.kind).toBe("record.restore");
  });
});

describe("H8.52 removing areas", () => {
  it("removes an empty area, and says to hide one that has places inside it or ads", async () => {
    const { city } = await chain();
    const district = await createArea(admin, { parentId: String(city._id), name: "Old Town" });
    const locality = await createArea(admin, { parentId: district.id, name: "Market" });
    await expect(removeArea(admin, district.id)).rejects.toBeInstanceOf(ConflictError);
    await removeArea(admin, locality.id);
    expect(await Location.exists({ _id: locality.id })).toBeNull();
    await Listing.create({ ownerId: oid(), categoryId: oid(), cityId: city._id, districtId: district.id, title: "Ad", description: "A description that is long enough", slug: "an-ad", status: "active" });
    await expect(removeArea(admin, district.id)).rejects.toThrow("Hide it instead");
    await Listing.deleteMany({});
    await removeArea(admin, district.id);
    expect(await Location.exists({ _id: district.id })).toBeNull();
    await expect(removeArea(admin, String(city._id))).rejects.toThrow("not found");
  });
});
