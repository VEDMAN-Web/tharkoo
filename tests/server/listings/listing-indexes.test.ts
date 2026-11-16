import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { syncListingIndexes, WANTED } from "../../../scripts/sync-listing-indexes.mjs";
import { Listing } from "@/server/models";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await Listing.init();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("listing indexes (H7.92)", () => {
  it("the schema declares the compound indexes the live find uses", async () => {
    const names = (await Listing.collection.indexes()).map((index) => index.name);
    for (const wanted of WANTED) expect(names, wanted.name).toContain(wanted.name);
  });

  it("a state filter and a city filter are served by an index, not a collection scan", async () => {
    const state = new mongoose.Types.ObjectId();
    const city = new mongoose.Types.ObjectId();
    for (const filter of [{ status: "active", stateId: state }, { status: "active", cityId: city }]) {
      const plan = JSON.stringify(await Listing.collection.find(filter).explain("queryPlanner"));
      expect(plan).toContain("IXSCAN");
      expect(plan).not.toContain("COLLSCAN");
    }
  });

  it("the sync script lists, finds nothing missing, and a second apply changes nothing", async () => {
    const db = mongoose.connection.db!;
    const dry = await syncListingIndexes(db);
    expect(dry).toMatchObject({ apply: false, missing: [], created: [] });
    await db.collection("listings").dropIndex("status_1_stateId_1_publishedAt_-1");
    const before = await syncListingIndexes(db);
    expect(before.missing).toEqual(["status_1_stateId_1_publishedAt_-1"]);
    expect((await syncListingIndexes(db)).created).toEqual([]);
    const applied = await syncListingIndexes(db, { apply: true });
    expect(applied.created).toEqual(["status_1_stateId_1_publishedAt_-1"]);
    expect((await syncListingIndexes(db, { apply: true })).created).toEqual([]);
  });
});
