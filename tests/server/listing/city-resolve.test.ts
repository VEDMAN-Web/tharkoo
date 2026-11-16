import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { getCityBySlug } from "@/lib/queries";
import { Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const globalForMongo = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (globalForMongo.mongoose) {
    globalForMongo.mongoose.conn = null;
    globalForMongo.mongoose.promise = null;
  }
}

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
  invalidateTags(["categories", "locations"]);
});

describe("getCityBySlug", () => {
  it.each([
    ["delhi", "Delhi"],
    ["chandigarh", "Chandigarh"],
    ["puducherry", "Puducherry"],
  ])("finds the city when %s is also a state", async (slug, name) => {
    const country = await Location.create({ type: "country", slug: "india", name: "India", parentId: null, enabled: true, order: 0 });
    const state = await Location.create({ type: "state", slug, name, parentId: country._id, enabled: true, order: 0 });
    await Location.create({ type: "city", slug, name, parentId: state._id, enabled: true, order: 0 });
    const city = await getCityBySlug(slug);
    expect(city?.kind).toBe("city");
    expect(city?.slug).toBe(slug);
    expect(city?.stateSlug).toBe(slug);
  });

  it("returns null for a state that has no city of the same slug", async () => {
    const country = await Location.create({ type: "country", slug: "india", name: "India", parentId: null, enabled: true, order: 0 });
    await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", parentId: country._id, enabled: true, order: 0 });
    expect(await getCityBySlug("gujarat")).toBeNull();
  });
});
