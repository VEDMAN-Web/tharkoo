import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as categoryGet } from "@/app/api/categories/route";
import { GET as locationGet } from "@/app/api/locations/[[...slug]]/route";
import { invalidateTags } from "@/lib/cache";
import { getDistricts, getLocationBySlug, getSiblingCities } from "@/lib/queries";
import { Category, Location } from "@/server/models";
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

async function chain() {
  const country = await Location.create({
    type: "country",
    slug: "india",
    name: "India",
    parentId: null,
    enabled: true,
    order: 0,
  });
  const state = await Location.create({
    type: "state",
    slug: "maharashtra",
    name: "Maharashtra",
    parentId: country._id,
    enabled: true,
    order: 0,
    oldSlugs: ["maha"],
  });
  const city = await Location.create({
    type: "city",
    slug: "pune",
    name: "Pune",
    parentId: state._id,
    enabled: true,
    order: 0,
  });
  await Location.create({
    type: "city",
    slug: "nagpur",
    name: "Nagpur",
    parentId: state._id,
    enabled: true,
    order: 1,
  });
  await Location.create({
    type: "city",
    slug: "hidden-city",
    name: "Hidden",
    parentId: state._id,
    enabled: false,
    order: 2,
  });
  await Location.create({
    type: "district",
    slug: "pune-city",
    name: "Pune City",
    parentId: city._id,
    enabled: true,
    order: 0,
  });
  await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
  await Category.create({ slug: "old-jobs", name: "Jobs", enabled: true, order: 1, oldSlugs: ["work"], deletedAt: null });
  await Category.create({ slug: "closed", name: "Closed", enabled: false, order: 2 });
  await Category.create({ slug: "gone", name: "Gone", enabled: true, order: 3, deletedAt: new Date("2026-01-01T00:00:00.000Z") });
  return { country, state, city };
}

describe("locations and categories", () => {
  it("resolves the current chain and redirects old slugs", async () => {
    await chain();
    const current = await locationGet(
      new Request("http://localhost/api/locations/resolve?slugs=india&slugs=maharashtra&slugs=pune", {
        headers: { "x-forwarded-for": "203.0.113.20" },
      }),
    );
    expect(current.status).toBe(200);
    const currentBody = (await current.json()) as { data: { chain: { slug: string; type: string }[] } };
    expect(currentBody.data.chain.map((row) => row.slug)).toEqual(["india", "maharashtra", "pune"]);
    expect(currentBody.data.chain.map((row) => row.type)).toEqual(["country", "state", "city"]);

    const old = await locationGet(
      new Request("http://localhost/api/locations/resolve?slugs=india&slugs=maha", {
        headers: { "x-forwarded-for": "203.0.113.20" },
      }),
    );
    expect(old.status).toBe(301);
    expect(old.headers.get("location")).toBe("/api/locations/resolve?slugs=india&slugs=maharashtra");
    const oldBody = (await old.json()) as { ok: boolean; data: { chain: { slug: string }[] }; meta: { canonicalSlugs: string[] } };
    expect(oldBody.ok).toBe(true);
    expect(oldBody.data.chain.map((row) => row.slug)).toEqual(["india", "maharashtra"]);
    expect(oldBody.meta.canonicalSlugs).toEqual(["india", "maharashtra"]);

    const missing = await locationGet(
      new Request("http://localhost/api/locations/resolve?slugs=india&slugs=missing", {
        headers: { "x-forwarded-for": "203.0.113.20" },
      }),
    );
    expect(missing.status).toBe(404);
  });

  it("lists children and hides disabled rows", async () => {
    const { state, city } = await chain();
    const children = await locationGet(
      new Request(`http://localhost/api/locations/${state._id.toString()}/children`, {
        headers: { "x-forwarded-for": "203.0.113.21" },
      }),
    );
    expect(children.status).toBe(200);
    const body = (await children.json()) as { data: { locations: { slug: string }[] } };
    expect(body.data.locations.map((row) => row.slug).sort()).toEqual(["nagpur", "pune"]);

    const missing = await locationGet(
      new Request(`http://localhost/api/locations/${new mongoose.Types.ObjectId().toString()}/children`, {
        headers: { "x-forwarded-for": "203.0.113.21" },
      }),
    );
    expect(missing.status).toBe(404);

    const loc = await getLocationBySlug("pune");
    expect(loc?.kind).toBe("city");
    expect(loc?.stateSlug).toBe("maharashtra");
    expect(loc?.status).toBe("active");
    expect((await getLocationBySlug("maha"))?.slug).toBe("maharashtra");
    expect((await getSiblingCities("maharashtra")).map((row) => row.slug).sort()).toEqual(["nagpur", "pune"]);
    expect((await getDistricts("pune")).map((row) => row.slug)).toEqual(["pune-city"]);
    expect(city.slug).toBe("pune");

    const categories = await categoryGet(
      new Request("http://localhost/api/categories", { headers: { "x-forwarded-for": "203.0.113.22" } }),
    );
    const categoryBody = (await categories.json()) as { data: { categories: { slug: string }[] } };
    expect(categoryBody.data.categories.map((row) => row.slug).sort()).toEqual(["jobs", "old-jobs"]);
  });
});
