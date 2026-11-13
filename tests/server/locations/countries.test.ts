import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { buildCountryDirectory, flagFromCode, footerCountries, loadCountryDirectory } from "@/server/locations/countries";
import { createPlace, deletePlace, updatePlace } from "@/server/locations/manage";
import { Listing, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "", roles: ["admin"] };

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
  }
}

function row(type: "country" | "state" | "city", slug: string, parentId: Types.ObjectId | null, extra: Record<string, unknown> = {}) {
  return { _id: new Types.ObjectId(), type, slug, name: slug.toUpperCase(), parentId, enabled: true, order: 0, ...extra };
}

describe("flagFromCode", () => {
  it("turns two letters into a flag and rejects anything else", () => {
    expect(flagFromCode("in")).toBe("\u{1F1EE}\u{1F1F3}");
    expect(flagFromCode("IND")).toBe("");
    expect(flagFromCode(undefined)).toBe("");
  });
});

describe("buildCountryDirectory", () => {
  const india = row("country", "india", null, { countryCode: "IN" });
  const nepal = row("country", "nepal", null, { countryCode: "NP" });
  const state = row("state", "goa", india._id);
  const goaCity = row("city", "panaji", state._id);
  const emptyCity = row("city", "margao", state._id);
  const hiddenCity = row("city", "hidden", state._id, { enabled: false });
  const rows = [india, nepal, state, goaCity, emptyCity, hiddenCity];
  const counts = new Map([[String(goaCity._id), 4], [String(hiddenCity._id), 9]]);

  it("rolls city counts up to the country and skips hidden places", () => {
    const all = buildCountryDirectory(rows, counts);
    expect(all.map((c) => [c.slug, c.count, c.cities.length])).toEqual([["india", 4, 2], ["nepal", 0, 0]]);
  });

  it("with onlyWithAds drops places that have no live ad", () => {
    const all = buildCountryDirectory(rows, counts, { onlyWithAds: true });
    expect(all).toHaveLength(1);
    expect(all[0].cities.map((c) => c.slug)).toEqual(["panaji"]);
  });

  it("footerCountries shows at most 12, busiest first", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ slug: `c${i}`, name: `C${i}`, flag: "", count: i, cities: [] }));
    const shown = footerCountries(many);
    expect(shown).toHaveLength(12);
    expect(shown[0].slug).toBe("c14");
    expect(shown.some((c) => c.count === 0)).toBe(false);
  });
});

describe("country directory from the database and admin changes", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    delete process.env.MONGODB_URI;
    resetDbCache();
    await connectMemoryMongo();
  });
  afterAll(async () => {
    await disconnectMemoryMongo();
    resetDbCache();
  });
  beforeEach(async () => {
    await clearMemoryMongo();
    invalidateTags(["locations", "listings"]);
  });

  it("counts only active, unexpired ads", async () => {
    const { id: countryId } = await createPlace(admin, { type: "country", name: "India", countryCode: "IN" });
    const { id: stateId } = await createPlace(admin, { type: "state", name: "Goa", parentId: countryId });
    const { id: cityId } = await createPlace(admin, { type: "city", name: "Panaji", parentId: stateId });
    const base = { ownerId: new Types.ObjectId(), categoryId: new Types.ObjectId(), cityId: new Types.ObjectId(cityId), title: "t", description: "d" };
    await Listing.create({ ...base, status: "active" });
    await Listing.create({ ...base, status: "active", expiresAt: new Date(Date.now() - 1000) });
    await Listing.create({ ...base, status: "paused" });
    const all = await loadCountryDirectory();
    expect(all[0].count).toBe(1);
    expect(all[0].cities[0]).toMatchObject({ slug: "panaji", count: 1 });
  });

  it("blocks non-admins, needs a flag code for a country, and checks the parent", async () => {
    await expect(createPlace({ email: "", roles: ["user"] }, { type: "country", name: "X", countryCode: "XX" })).rejects.toThrow();
    await expect(createPlace(admin, { type: "country", name: "Nowhere" })).rejects.toThrow(/Flag code/);
    await expect(createPlace(admin, { type: "city", name: "Orphan" })).rejects.toThrow(/belongs to/);
  });

  it("hides a place, and blocks removal when it has ads or children", async () => {
    const { id: countryId } = await createPlace(admin, { type: "country", name: "India", countryCode: "IN" });
    const { id: stateId } = await createPlace(admin, { type: "state", name: "Goa", parentId: countryId });
    await expect(deletePlace(admin, countryId)).rejects.toThrow(/inside it/);
    await updatePlace(admin, countryId, { enabled: false });
    expect((await Location.findById(countryId))?.enabled).toBe(false);
    await Listing.create({ ownerId: new Types.ObjectId(), categoryId: new Types.ObjectId(), stateId: new Types.ObjectId(stateId), status: "active", title: "t", description: "d" });
    await expect(deletePlace(admin, stateId)).rejects.toThrow(/has ads/);
  });

  it("removes an empty place", async () => {
    const { id } = await createPlace(admin, { type: "country", name: "Spare", countryCode: "SP" });
    await deletePlace(admin, id);
    expect(await Location.findById(id)).toBeNull();
  });
});
