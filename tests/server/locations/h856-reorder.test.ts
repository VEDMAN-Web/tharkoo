import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { reorderPlaces } from "@/server/locations/reorder";
import { loadPlacesScreen } from "@/server/locations/screen";
import { AuditEvent, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: AdminCtx = { actorId: "000000000000000000000091", email: "admin@example.com", roles: ["admin"], requestId: "r-a" };
const support: AdminCtx = { actorId: "000000000000000000000092", email: "sup@example.com", roles: ["support"], requestId: "r-s" };

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

async function seed() {
  const country = await Location.create({ type: "country", slug: "india", name: "India", countryCode: "IN" });
  const states = await Location.create([
    { type: "state", slug: "goa", name: "Goa", parentId: country._id, order: 3 },
    { type: "state", slug: "kerala", name: "Kerala", parentId: country._id, order: 7 },
  ]);
  const cities = await Location.create(["Agra", "Bhopal", "Chennai", "Delhi", "Erode", "Faridabad"].map((name) => ({ type: "city" as const, slug: name.toLowerCase(), name, parentId: states[0]._id })));
  return { country, states, cities };
}

const cityNames = async () => (await loadPlacesScreen({})).rows.filter((row) => row.type === "city").map((row) => row.name);

describe("H8.56 reorder places", () => {
  it("moved places swap among the spots they held, the kind is numbered again, and the list shows the new order", async () => {
    const { cities } = await seed();
    expect(await cityNames()).toEqual(["Agra", "Bhopal", "Chennai", "Delhi", "Erode", "Faridabad"]);
    const result = await reorderPlaces(admin, [String(cities[3]._id), String(cities[1]._id)]);
    expect(result.moved).toBeGreaterThan(0);
    expect(await cityNames()).toEqual(["Agra", "Delhi", "Chennai", "Bhopal", "Erode", "Faridabad"]);
    const orders = (await Location.find({ type: "city" }).select("name order").lean()).map((row) => `${row.name}:${row.order}`).sort();
    expect(orders).toEqual(["Agra:0", "Bhopal:3", "Chennai:2", "Delhi:1", "Erode:4", "Faridabad:5"]);
    await reorderPlaces(admin, [String(cities[5]._id), String(cities[0]._id)]);
    expect(await cityNames()).toEqual(["Faridabad", "Delhi", "Chennai", "Bhopal", "Erode", "Agra"]);
  });

  it("leaves other kinds alone, writes one audit row, and refuses mixed kinds, one place, unknown places and a role without the permission", async () => {
    const { states, cities } = await seed();
    await reorderPlaces(admin, [String(cities[2]._id), String(cities[0]._id)]);
    expect((await Location.find({ type: "state" }).select("slug order").sort({ slug: 1 }).lean()).map((row) => `${row.slug}:${row.order}`)).toEqual(["goa:3", "kerala:7"]);
    expect(await AuditEvent.countDocuments({ action: "location.reorder" })).toBe(1);
    await expect(reorderPlaces(admin, [String(cities[0]._id), String(states[0]._id)])).rejects.toBeInstanceOf(ValidationError);
    await expect(reorderPlaces(admin, [String(cities[0]._id)])).rejects.toBeInstanceOf(ValidationError);
    await expect(reorderPlaces(admin, [String(cities[0]._id), String(new mongoose.Types.ObjectId())])).rejects.toBeInstanceOf(NotFoundError);
    await expect(reorderPlaces(support, [String(cities[0]._id), String(cities[1]._id)])).rejects.toBeInstanceOf(ForbiddenError);
    await reorderPlaces(admin, [String(states[1]._id), String(states[0]._id)]);
    expect((await loadPlacesScreen({})).rows.filter((row) => row.type === "state").map((row) => row.name)).toEqual(["Kerala", "Goa"]);
  });
});
